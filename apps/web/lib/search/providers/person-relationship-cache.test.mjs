import assert from 'node:assert/strict'
import test from 'node:test'
import { PERSON_RELATIONSHIP_SCHEMA_VERSION } from '../person-relationships.ts'
import {
  createPersonRelationshipCache,
  createUpstashPersonRelationshipStore,
  personRelationshipCacheKey,
} from './person-relationship-cache.ts'

const cached = {
  schemaVersion: PERSON_RELATIONSHIP_SCHEMA_VERSION,
  personId: 30614,
  aliases: ['Ryan Gosling'],
  knownForDepartment: 'Acting',
  movieCredits: [],
  tvCredits: [],
  complete: true,
  updatedAt: '2026-07-20T00:00:00.000Z',
}

test('returns a stale complete record immediately and schedules refresh without awaiting it', async () => {
  let release
  const scheduled = new Promise((resolve) => {
    release = resolve
  })
  const calls = []
  const cache = createPersonRelationshipCache({
    store: {
      get: async (key) => {
        calls.push(['get', key])
        return cached
      },
      set: async () => undefined,
    },
    scheduler: {
      schedule(input) {
        calls.push(['schedule', input.personId])
        return scheduled
      },
    },
    now: () => Date.parse('2026-07-29T00:00:00.000Z'),
  })

  const result = await cache.get(30614)
  assert.equal(result.state, 'stale_complete')
  assert.equal(result.record, cached)
  assert.deepEqual(calls, [
    ['get', personRelationshipCacheKey(30614)],
    ['schedule', 30614],
  ])
  release()
})

test('treats store and scheduler failures as cache misses or best-effort refresh failures', async () => {
  const cache = createPersonRelationshipCache({
    store: {
      get: async () => {
        throw new Error('store unavailable')
      },
      set: async () => undefined,
    },
    scheduler: {
      schedule: async () => {
        throw new Error('scheduler unavailable')
      },
    },
  })

  assert.deepEqual(await cache.get(30614), { state: 'missing' })
  await cache.scheduleRefresh({ personId: 30614, reason: 'missing' })
})

test('reads and writes versioned records through the injected Upstash REST boundary', async () => {
  const requests = []
  const responses = [
    new Response(JSON.stringify([{ result: JSON.stringify(cached) }]), { status: 200 }),
    new Response(JSON.stringify([{ result: 'OK' }]), { status: 200 }),
  ]
  const store = createUpstashPersonRelationshipStore({
    url: 'https://redis.example',
    token: 'secret',
    fetch: async (url, init) => {
      requests.push({ url: String(url), init })
      return responses.shift()
    },
  })

  assert.deepEqual(await store.get('relationship-key'), cached)
  await store.set('relationship-key', cached)
  assert.equal(requests[0].url, 'https://redis.example/pipeline')
  assert.deepEqual(JSON.parse(requests[0].init.body), [['GET', 'relationship-key']])
  assert.deepEqual(JSON.parse(requests[1].init.body), [
    ['SET', 'relationship-key', JSON.stringify(cached), 'EX', '2592000'],
  ])
  assert.equal(requests[0].init.headers.authorization, 'Bearer secret')
})
