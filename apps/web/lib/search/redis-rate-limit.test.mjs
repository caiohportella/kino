import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createFallbackSearchRateLimiter,
  createUpstashRedisRateLimitStore,
  searchClientKey,
} from './rate-limit.ts'

test('consumes an atomic bounded Redis window and normalizes its decision', async () => {
  let request
  const store = createUpstashRedisRateLimitStore({
    url: 'https://redis.example.test',
    token: 'redis-secret',
    fetch: async (url, init) => {
      request = { url, init }
      return Response.json([{ result: 3 }, { result: 1_500 }])
    },
  })

  assert.deepEqual(await store.consume({ key: 'ip:203.0.113.4', limit: 2, windowMs: 10_000 }), {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 2,
  })
  assert.equal(request.url, 'https://redis.example.test/pipeline')
  assert.equal(request.init.headers.authorization, 'Bearer redis-secret')
  const commands = JSON.parse(request.init.body)
  assert.equal(commands[0][0], 'EVAL')
  assert.match(commands[0][1], /INCR/u)
  assert.deepEqual(commands[0].slice(2), ['1', 'kino:search:ip:203.0.113.4', '10000'])
  assert.deepEqual(commands[1], ['PTTL', 'kino:search:ip:203.0.113.4'])
})

test('falls back to a bounded local limiter when the trusted store fails', async () => {
  const limiter = createFallbackSearchRateLimiter({
    primary: { check: async () => Promise.reject(new Error('redis unavailable')) },
    fallback: {
      check: async () => ({ allowed: false, remaining: 0, retryAfterSeconds: 3 }),
    },
  })
  assert.deepEqual(await limiter.check('client'), {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 3,
  })
})

test('derives a bounded client key only from a valid trusted proxy address', () => {
  assert.equal(
    searchClientKey(
      new Request('https://kino.example/api/v1/search', {
        headers: { 'x-vercel-forwarded-for': '203.0.113.4, 10.0.0.1' },
      })
    ),
    'ip:203.0.113.4'
  )
  assert.equal(
    searchClientKey(
      new Request('https://kino.example/api/v1/search', {
        headers: { 'x-vercel-forwarded-for': 'attacker-controlled-value' },
      })
    ),
    'ip:unknown'
  )
})
