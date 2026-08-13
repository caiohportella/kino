import assert from 'node:assert/strict'
import test from 'node:test'

import { readRedisServerEnv, readTmdbServerApiKey, readVectorServerEnv } from './server-env.ts'

test('reads only server Redis credentials and ignores public-prefixed values', () => {
  const reads = []
  const env = new Proxy(
    {
      UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: 'redis-secret',
      NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: 'https://public.example.test',
      NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: 'public-token',
    },
    {
      get(target, property) {
        reads.push(property)
        return target[property]
      },
    }
  )

  assert.deepEqual(readRedisServerEnv(env), {
    url: 'https://redis.example.test',
    token: 'redis-secret',
  })
  assert.deepEqual(reads, ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'])
})

test('returns null when Redis credentials are absent, including public-prefixed values', () => {
  assert.equal(readRedisServerEnv({}), null)
  assert.equal(
    readRedisServerEnv({
      NEXT_PUBLIC_UPSTASH_REDIS_REST_URL: 'https://public.example.test',
      NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN: 'public-token',
    }),
    null
  )
})

test('rejects partial, non-HTTPS, or whitespace-padded Redis configuration', () => {
  for (const env of [
    { UPSTASH_REDIS_REST_URL: 'https://redis.example.test' },
    { UPSTASH_REDIS_REST_TOKEN: 'redis-secret' },
    {
      UPSTASH_REDIS_REST_URL: 'http://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: 'redis-secret',
    },
    {
      UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: ' redis-secret',
    },
  ]) {
    assert.throws(
      () => readRedisServerEnv(env),
      (error) =>
        error.code === 'invalid_server_configuration' &&
        error.message === 'Redis server configuration is invalid'
    )
  }
})

test('keeps the existing server-only vector and TMDB readers available', () => {
  assert.deepEqual(
    readVectorServerEnv({
      UPSTASH_VECTOR_REST_URL: 'https://vector.example.test',
      UPSTASH_VECTOR_REST_TOKEN: 'vector-secret',
    }),
    { url: 'https://vector.example.test', token: 'vector-secret' }
  )
  assert.equal(
    readTmdbServerApiKey({
      TMDB_API_KEY: 'server-tmdb-key',
      NEXT_PUBLIC_TMDB_API_KEY: 'public-tmdb-key',
    }),
    'server-tmdb-key'
  )
})
