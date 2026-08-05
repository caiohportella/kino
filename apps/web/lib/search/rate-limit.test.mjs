import assert from 'node:assert/strict'
import test from 'node:test'

import { createMemorySearchRateLimiter, createTrustedStoreSearchRateLimiter } from './rate-limit.ts'

test('rejects requests over the fixed-window limit with a bounded retry delay', async () => {
  let now = 1_000
  const limiter = createMemorySearchRateLimiter({
    limit: 2,
    windowMs: 10_000,
    maxKeys: 100,
    now: () => now,
  })

  assert.deepEqual(await limiter.check('client-a'), { allowed: true, remaining: 1 })
  assert.deepEqual(await limiter.check('client-a'), { allowed: true, remaining: 0 })
  assert.deepEqual(await limiter.check('client-a'), {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 10,
  })
  now = 11_001
  assert.deepEqual(await limiter.check('client-a'), { allowed: true, remaining: 1 })
})

test('bounds local-development client state by evicting the least recently seen key', async () => {
  let now = 0
  const limiter = createMemorySearchRateLimiter({
    limit: 1,
    windowMs: 60_000,
    maxKeys: 2,
    now: () => now,
  })

  assert.equal((await limiter.check('client-a')).allowed, true)
  now = 1
  assert.equal((await limiter.check('client-b')).allowed, true)
  now = 2
  assert.equal((await limiter.check('client-a')).allowed, false)
  now = 3
  assert.equal((await limiter.check('client-c')).allowed, true)
  now = 4
  assert.equal((await limiter.check('client-b')).allowed, true)
})

test('delegates production decisions to the trusted store with caller cancellation', async () => {
  const calls = []
  const controller = new AbortController()
  const limiter = createTrustedStoreSearchRateLimiter({
    limit: 20,
    windowMs: 60_000,
    store: {
      consume: async (input, signal) => {
        calls.push({ input, signal })
        return { allowed: false, remaining: 0, retryAfterSeconds: 4 }
      },
    },
  })

  assert.deepEqual(await limiter.check('client-a', controller.signal), {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 4,
  })
  assert.deepEqual(calls, [
    {
      input: { key: 'client-a', limit: 20, windowMs: 60_000 },
      signal: controller.signal,
    },
  ])
})
