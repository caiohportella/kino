import assert from 'node:assert/strict'
import test from 'node:test'
import { createMobileAuthResolver } from './authResolution.ts'

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
  let refreshCalls = 0
  let refreshResult = Promise.resolve({ data: { session }, error: null })

  return {
    source: {
      getSession() {
        return initialResult
      },
      onAuthStateChange(nextListener) {
        listener = nextListener
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        }
      },
      refreshSession() {
        refreshCalls += 1
        return refreshResult
      },
    },
    emit(event, nextSession) {
      listener(event, nextSession)
    },
    failRefresh(error) {
      refreshResult = Promise.resolve({ data: { session: null }, error })
    },
    setRefreshResult(result) {
      refreshResult = result
    },
    refreshCalls() {
      return refreshCalls
    },
  }
}

test('delays mobile auth resolution until a persisted session is restored', async () => {
  const pending = deferred()
  const fake = createFakeAuthSource(pending.promise)
  const snapshots = []
  const resolver = createMobileAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

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

test('resolves an absent persisted mobile session only after restoration finishes', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session: null }, error: null }))
  const snapshots = []
  const resolver = createMobileAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()
  await Promise.resolve()

  assert.deepEqual(snapshots.at(-1), {
    resolution: { status: 'unauthenticated' },
    session: null,
  })
})

test('does not refresh when mobile has no authenticated session', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session: null }, error: null }))
  const snapshots = []
  const resolver = createMobileAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()
  await Promise.resolve()
  await resolver.refresh()

  assert.deepEqual(snapshots.at(-1), {
    resolution: { status: 'unauthenticated' },
    session: null,
  })
  assert.equal(fake.refreshCalls(), 0)
})

test('retains the prior session after a temporary app-active refresh failure', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session }, error: null }))
  fake.failRefresh({ message: 'Network request failed', status: 503 })
  const snapshots = []
  const resolver = createMobileAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

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

test('treats mobile signed-out events as authoritative invalidation', async () => {
  const fake = createFakeAuthSource(Promise.resolve({ data: { session }, error: null }))
  const snapshots = []
  const resolver = createMobileAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()
  await Promise.resolve()
  fake.emit('SIGNED_OUT', null)

  assert.deepEqual(snapshots.at(-1), {
    resolution: { status: 'unauthenticated' },
    session: null,
  })
})

test('does not restore a stale refresh result after authoritative sign-out', async () => {
  const refresh = deferred()
  const fake = createFakeAuthSource(Promise.resolve({ data: { session }, error: null }))
  fake.setRefreshResult(refresh.promise)
  const snapshots = []
  const resolver = createMobileAuthResolver(fake.source, (snapshot) => snapshots.push(snapshot))

  resolver.initialize()
  await Promise.resolve()
  const refreshing = resolver.refresh()
  fake.emit('SIGNED_OUT', null)
  refresh.resolve({ data: { session }, error: null })
  await refreshing

  assert.deepEqual(snapshots.at(-1), {
    resolution: { status: 'unauthenticated' },
    session: null,
  })
})
