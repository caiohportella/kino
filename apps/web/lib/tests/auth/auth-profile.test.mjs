import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthProfileEnsurer } from '../../auth/auth-profile-resolution.ts'

function deferred() {
  let resolve
  const promise = new Promise((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

function user(id = 'user-1') {
  return { id, email: 'person@example.com', user_metadata: {} }
}

test('throws PostgREST errors from profile reads, updates, and inserts', async (t) => {
  await t.test('read', async () => {
    const ensure = createAuthProfileEnsurer({
      read: async () => ({ data: null, error: { message: 'read failed' } }),
      update: async () => ({ error: null }),
      insert: async () => ({ error: null }),
    })
    await assert.rejects(ensure(user()), /read failed/)
  })

  await t.test('update', async () => {
    const ensure = createAuthProfileEnsurer({
      read: async () => ({
        data: { id: 'user-1', display_name: null, username: 'person' },
        error: null,
      }),
      update: async () => ({ error: { message: 'update failed' } }),
      insert: async () => ({ error: null }),
    })
    await assert.rejects(ensure(user()), /update failed/)
  })

  await t.test('insert', async () => {
    const ensure = createAuthProfileEnsurer({
      read: async () => ({ data: null, error: null }),
      update: async () => ({ error: null }),
      insert: async () => ({ error: { message: 'insert failed' } }),
    })
    await assert.rejects(ensure(user()), /insert failed/)
  })
})

test('suppresses stale same-user profile request results', async () => {
  const first = deferred()
  const second = deferred()
  const reads = [first.promise, second.promise]
  const statuses = []
  let updates = 0
  const ensure = createAuthProfileEnsurer({
    read: async () => reads.shift(),
    update: async () => {
      updates += 1
      return { error: null }
    },
    insert: async () => ({ error: null }),
  })

  const stale = ensure(user(), (status) => statuses.push(status))
  const current = ensure(user(), (status) => statuses.push(status))
  second.resolve({ data: { id: 'user-1', display_name: 'Person', username: null }, error: null })
  await current
  first.resolve({ data: { id: 'user-1', display_name: null, username: null }, error: null })
  await stale

  assert.deepEqual(statuses, ['loading', 'loading', 'ready'])
  assert.equal(updates, 0)
})
