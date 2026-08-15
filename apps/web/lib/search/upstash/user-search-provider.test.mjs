import assert from 'node:assert/strict'
import test from 'node:test'

import { createRedisUserSearchProvider } from './user-search-provider.ts'

test('ranks exact username above display-name fuzzy matches', async () => {
  const calls = []
  const provider = createRedisUserSearchProvider({
    searchIndex: {
      async query(options) {
        calls.push(options)
        return [
          {
            key: 'kino:search:user:alice',
            score: 0.6,
            data: {
              id: 'user:alice',
              entityType: 'user',
              userId: 'alice',
              username: 'alice',
              displayName: 'Alice Example',
              firstName: 'Alice',
              lastName: 'Example',
              bio: '',
              popularity: 1,
            },
          },
          {
            key: 'kino:search:user:bob',
            score: 0.95,
            data: {
              id: 'user:bob',
              entityType: 'user',
              userId: 'bob',
              username: 'bob',
              displayName: 'Alice Fan',
              firstName: 'Alice',
              lastName: 'Fan',
              bio: '',
              popularity: 100,
            },
          },
        ]
      },
    },
  })
  const result = await provider.search({ query: 'alice', limit: 8 })
  assert.equal(result.results[0]?.entity.id, 'user:alice')
  assert.equal(calls.length, 1)
})

test('uses the Supabase fallback only when Redis is unavailable or insufficient', async () => {
  let fallbackCalls = 0
  const fallback = async () => {
    fallbackCalls += 1
    return [
      {
        id: 'fallback',
        username: 'fallback',
        display_name: 'Fallback User',
        avatar_url: null,
        bio: null,
      },
    ]
  }
  const provider = createRedisUserSearchProvider({
    searchIndex: {
      async query() {
        return []
      },
    },
    searchUsersFallback: fallback,
  })
  const result = await provider.search({ query: 'fall', limit: 8 })
  assert.equal(fallbackCalls, 1)
  assert.equal(result.results[0]?.entity.id, 'user:fallback')
})
