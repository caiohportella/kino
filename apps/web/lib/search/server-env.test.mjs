import assert from 'node:assert/strict'
import test from 'node:test'

import { readRedisServerEnv, readTmdbServerApiKey, readVectorServerEnv } from './server-env.ts'

test('reads only server Upstash credentials and ignores public-prefixed values', () => {
  const reads = []
  const env = new Proxy(
    {
      UPSTASH_VECTOR_REST_URL: 'https://vector.example.test',
      UPSTASH_VECTOR_REST_TOKEN: 'server-token',
      NEXT_PUBLIC_UPSTASH_VECTOR_REST_URL: 'https://public.example.test',
      NEXT_PUBLIC_UPSTASH_VECTOR_REST_TOKEN: 'public-token',
    },
    {
      get(target, property) {
        reads.push(property)
        return target[property]
      },
    }
  )

  assert.deepEqual(readVectorServerEnv(env), {
    url: 'https://vector.example.test',
    token: 'server-token',
  })
  assert.deepEqual(reads, ['UPSTASH_VECTOR_REST_URL', 'UPSTASH_VECTOR_REST_TOKEN'])
})

test('returns null when vector credentials are both absent so TMDB fallback remains usable', () => {
  assert.equal(readVectorServerEnv({}), null)
  assert.equal(
    readVectorServerEnv({
      NEXT_PUBLIC_UPSTASH_VECTOR_REST_URL: 'https://public.example.test',
      NEXT_PUBLIC_UPSTASH_VECTOR_REST_TOKEN: 'public-token',
    }),
    null
  )
})

test('rejects partial or malformed vector configuration without including credentials', () => {
  for (const env of [
    { UPSTASH_VECTOR_REST_URL: 'https://vector.example.test' },
    { UPSTASH_VECTOR_REST_TOKEN: 'server-token' },
    {
      UPSTASH_VECTOR_REST_URL: 'http://vector.example.test',
      UPSTASH_VECTOR_REST_TOKEN: 'server-token',
    },
  ]) {
    assert.throws(
      () => readVectorServerEnv(env),
      (error) =>
        error.code === 'invalid_server_configuration' &&
        error.message === 'Vector search server configuration is invalid'
    )
  }
})

test('reads only the server TMDB key and never falls back to a public credential', () => {
  assert.equal(
    readTmdbServerApiKey({
      TMDB_API_KEY: 'server-tmdb-key',
      NEXT_PUBLIC_TMDB_API_KEY: 'public-tmdb-key',
    }),
    'server-tmdb-key'
  )
  assert.equal(readTmdbServerApiKey({ NEXT_PUBLIC_TMDB_API_KEY: 'public-tmdb-key' }), null)
})

test('accepts only paired server-side Redis rate-limit credentials', () => {
  assert.deepEqual(
    readRedisServerEnv({
      UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: 'redis-secret',
    }),
    { url: 'https://redis.example.test', token: 'redis-secret' }
  )
  assert.equal(readRedisServerEnv({}), null)
  assert.throws(
    () => readRedisServerEnv({ UPSTASH_REDIS_REST_URL: 'https://redis.example.test' }),
    (error) => error.code === 'invalid_server_configuration'
  )
})
