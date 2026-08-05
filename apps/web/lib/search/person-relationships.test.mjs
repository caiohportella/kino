import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateRelationshipRecord,
  PERSON_RELATIONSHIP_SCHEMA_VERSION,
} from './person-relationships.ts'

const now = Date.parse('2026-07-29T12:00:00.000Z')
const credit = {
  entity: { id: 'movie:1', entityType: 'movie', tmdbId: 1, title: 'Drive' },
  role: 'acting',
  castOrder: 0,
}

function record(overrides = {}) {
  return {
    schemaVersion: PERSON_RELATIONSHIP_SCHEMA_VERSION,
    personId: 30614,
    aliases: ['Ryan Gosling'],
    knownForDepartment: 'Acting',
    movieCredits: [credit],
    tvCredits: [],
    complete: true,
    updatedAt: new Date(now - 1_000).toISOString(),
    ...overrides,
  }
}

test('distinguishes missing, fresh complete, stale complete, and incomplete records', () => {
  assert.deepEqual(evaluateRelationshipRecord(null, { now }), { state: 'missing' })
  assert.equal(evaluateRelationshipRecord(record(), { now }).state, 'fresh_complete')
  assert.equal(
    evaluateRelationshipRecord(
      record({ updatedAt: new Date(now - 8 * 24 * 60 * 60 * 1_000).toISOString() }),
      { now }
    ).state,
    'stale_complete'
  )
  assert.equal(evaluateRelationshipRecord(record({ complete: false }), { now }).state, 'incomplete')
})

test('rejects old-version, corrupt, and oversized records', () => {
  assert.equal(
    evaluateRelationshipRecord(record({ schemaVersion: 0 }), { now }).state,
    'incompatible'
  )
  assert.equal(
    evaluateRelationshipRecord({ ...record(), movieCredits: [{ bad: true }] }, { now }).state,
    'corrupt'
  )
  assert.equal(
    evaluateRelationshipRecord(
      record({ aliases: Array.from({ length: 33 }, (_, index) => `alias-${index}`) }),
      { now }
    ).state,
    'oversized'
  )
  assert.equal(
    evaluateRelationshipRecord(
      record({ movieCredits: Array.from({ length: 501 }, () => credit) }),
      { now }
    ).state,
    'oversized'
  )
})
