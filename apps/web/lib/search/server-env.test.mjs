import assert from 'node:assert/strict'
import test from 'node:test'

import { readVectorServerEnv } from './server-env.ts'

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
