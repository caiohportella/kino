import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthProfileResolver } from './authProfile.ts'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

test('drives profile readiness independently through idle, loading, and ready', async () => {
  const pending = deferred()
  const statuses = []
  const resolver = createAuthProfileResolver(
    () => pending.promise,
    (status) => statuses.push(status)
  )

  const resolution = resolver.resolve({ id: 'user-1' })
  assert.deepEqual(statuses, ['loading'])

  pending.resolve(null)
  await resolution
  assert.deepEqual(statuses, ['loading', 'ready'])

  await resolver.resolve(null)
  assert.deepEqual(statuses, ['loading', 'ready', 'idle'])
})

test('reports profile read failures and ignores stale same-user results', async () => {
  const first = deferred()
  const second = deferred()
  const reads = [first.promise, second.promise]
  const statuses = []
  const resolver = createAuthProfileResolver(
    () => reads.shift(),
    (status) => statuses.push(status)
  )

  const stale = resolver.resolve({ id: 'user-1' })
  const current = resolver.resolve({ id: 'user-1' })
  second.reject(new Error('profile unavailable'))
  await assert.rejects(current, /profile unavailable/)
  first.resolve(null)
  await stale

  assert.deepEqual(statuses, ['loading', 'loading', 'error'])
})
