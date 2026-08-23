import assert from 'node:assert/strict'
import test from 'node:test'
import { createWebAuthResolver } from '../../auth/auth-resolution.ts'

const user = { id: 'user-1' }
const session = {
  access_token: 'access-token',
  expires_at: 123,
  expires_in: 3600,
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  user,
}

function deferred() {
  let resolve
  const promise = new Promise((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function createFakeAuthSource(initialResult) {
  let listener
  let getSessionCalls = 0
  let refreshSessionCalls = 0
  let subscriptionCalls = 0
  let unsubscribeCalls = 0
  let refreshResult = Promise.resolve({ data: { session }, error: null })

  return {
    source: {
      getSession() {
        getSessionCalls += 1
        return initialResult
      },
      onAuthStateChange(nextListener) {
        subscriptionCalls += 1
        listener = nextListener
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribeCalls += 1
              },
            },
          },
        }
      },
      refreshSession() {
        refreshSessionCalls += 1
        return refreshResult
      },
    },
    emit(event, nextSession) {
      listener(event, nextSession)
    },
    calls() {
      return {
        getSessionCalls,
        refreshSessionCalls,
        subscriptionCalls,
        unsubscribeCalls,
      }
    },
    failRefresh(error) {
      refreshResult = Promise.resolve({ data: { session: null }, error })
    },
  }
}

test('waits for delayed session restoration without emitting unauthenticated', async () => {
  const pending = deferred()
  const fake = createFakeAuthSource(pending.promise)
  const snapshots = []
  const resolver = createWebAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()

  assert.deepEqual(snapshots, [{ resolution: { status: 'resolving' }, session: null }])

  pending.resolve({ data: { session }, error: null })
  await pending.promise
  await Promise.resolve()

  assert.deepEqual(snapshots.at(-1), {
    resolution: { status: 'authenticated', user },
    session,
  })
})

test('keeps the previous valid session when a refresh event has no replacement', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session }, error: null }))
  const snapshots = []
  const resolver = createWebAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()
  await Promise.resolve()
  fake.emit('TOKEN_REFRESHED', null)

  assert.deepEqual(snapshots.at(-1), {
    resolution: { status: 'authenticated', user },
    session,
  })
})

test('treats signed-out events as authoritative invalidation', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session }, error: null }))
  const snapshots = []
  const resolver = createWebAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()
  await Promise.resolve()
  fake.emit('SIGNED_OUT', null)

  assert.deepEqual(snapshots.at(-1), {
    resolution: { status: 'unauthenticated' },
    session: null,
  })
})

test('initializes getSession and the auth subscription only once', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session: null }, error: null }))
  const resolver = createWebAuthResolver(fake.source, () => undefined)

  const firstCleanup = resolver.initialize()
  const secondCleanup = resolver.initialize()
  await Promise.resolve()

  assert.deepEqual(fake.calls(), {
    getSessionCalls: 1,
    refreshSessionCalls: 0,
    subscriptionCalls: 1,
    unsubscribeCalls: 0,
  })

  firstCleanup()
  secondCleanup()
  assert.equal(fake.calls().unsubscribeCalls, 1)
})

test('starts a fresh resolver lifecycle after provider cleanup and remount', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session }, error: null }))
  const resolver = createWebAuthResolver(fake.source, () => undefined)

  const firstCleanup = resolver.initialize()
  await Promise.resolve()
  firstCleanup()

  resolver.initialize()
  await Promise.resolve()

  assert.deepEqual(fake.calls(), {
    getSessionCalls: 2,
    refreshSessionCalls: 0,
    subscriptionCalls: 2,
    unsubscribeCalls: 1,
  })
})

test('records a typed refresh error while retaining the previous web session', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session }, error: null }))
  fake.failRefresh({ message: 'Network request failed', status: 503 })
  const snapshots = []
  const resolver = createWebAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()
  await Promise.resolve()
  await resolver.refresh()

  assert.deepEqual(snapshots.at(-1), {
    resolution: {
      status: 'error',
      error: {
        code: 'temporary_refresh_failure',
        message: 'Network request failed',
        recoverable: true,
      },
      previousUser: user,
    },
    session,
  })
})
