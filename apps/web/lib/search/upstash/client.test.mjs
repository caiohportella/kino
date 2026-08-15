import assert from 'node:assert/strict'
import test from 'node:test'

import { createRedisSearchClient } from './client.ts'

test('creates a server-only Upstash Redis client from explicit credentials', () => {
  const client = createRedisSearchClient({
    url: 'https://redis.example.test',
    token: 'redis-secret',
  })

  assert.equal(typeof client.json.set, 'function')
  assert.equal(typeof client.search.index, 'function')
})
