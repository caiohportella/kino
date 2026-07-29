import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPersonRelationshipCache,
  personRelationshipCacheKey,
} from './person-relationship-cache.ts'
import { PERSON_RELATIONSHIP_SCHEMA_VERSION } from '../person-relationships.ts'

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

