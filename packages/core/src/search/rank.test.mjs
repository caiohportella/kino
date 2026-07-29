import assert from 'node:assert/strict'
import test from 'node:test'
import { fuseSearchCandidates } from './fusion.ts'
import { normalizeSearchQuery } from './normalize.ts'
import { rankSearchCandidates } from './rank.ts'

const entity = (id, title, options = {}) => ({
  id: `movie:${id}`,
  entityType: 'movie',
  title,
  tmdbId: id,
  ...options,
})

function rank(query, candidates) {
  return rankSearchCandidates({
    query: normalizeSearchQuery(query),
    candidates: fuseSearchCandidates([{ sourceId: 'test', candidates }]),
  })
}

test('exact title and year beats broad semantic similarity', () => {
  const candidates = [
    { source: 'semantic', entity: entity(1, 'Deep Space Terror'), semanticScore: 0.99 },
    {
      source: 'lexical',
      entity: entity(348, 'Alien', { year: 1979 }),
      lexicalScore: 1,
      exactMatch: true,
      prefixMatch: true,
    },
  ]

  assert.deepEqual(
    rank('Alien 1979', candidates).map(({ entity: result }) => result.tmdbId),
    [348, 1]
  )
})

test('high-confidence person expansion beats incidental text mentions', () => {
  const candidates = [
    {
      source: 'lexical',
      entity: entity(90, 'Talking About Marlon Brando'),
      lexicalScore: 0.9,
      prefixMatch: true,
    },
    {
      source: 'relationship',
      entity: entity(238, 'The Godfather', { year: 1972 }),
      personId: 'person:3084',
      personConfidence: 0.97,
      role: 'acting',
      relationshipScore: 0.99,
      castOrder: 1,
    },
  ]

  assert.deepEqual(
    rank('Marlon Brando', candidates).map(({ entity: result }) => result.tmdbId),
    [238, 90]
  )
})

test('popularity cannot rescue a result with negligible relevance', () => {
  const candidates = [
    {
      source: 'semantic',
      entity: entity(1, 'Irrelevant Blockbuster', { popularity: 1_000_000, voteCount: 500_000 }),
      semanticScore: 0.02,
    },
    {
      source: 'semantic',
      entity: entity(2, 'Relevant Small Film', { popularity: 1, voteCount: 1 }),
      semanticScore: 0.55,
    },
  ]

  assert.deepEqual(
    rank('quiet lunar mystery', candidates).map(({ entity: result }) => result.tmdbId),
    [2, 1]
  )
})

test('keeps missing vote confidence neutral while bounded relationship evidence outranks low semantics', () => {
  const [relationship, semantic] = rank('Dexter starring Michael C. Hall', [
    {
      source: 'relationship',
      entity: entity(1405, 'Dexter', { popularity: 4 }),
      personId: 'person:6487',
      personConfidence: 0.8,
      role: 'acting',
      relationshipScore: 1,
      castOrder: 0,
    },
    {
      source: 'semantic',
      entity: entity(9999, 'Dexter Explained', { popularity: 50_000, voteCount: 400_000 }),
      semanticScore: 0.05,
    },
  ])

  assert.equal(relationship.entity.tmdbId, 1405)
  assert.equal(relationship.components.relationship, 1)
  assert.equal(relationship.components.voteConfidence, 0.5)
  assert.equal(semantic.entity.tmdbId, 9999)
})

test('merged duplicate evidence affects one ranked result', () => {
  const result = rank('Alien', [
    { source: 'semantic', entity: entity(348, 'Alien'), semanticScore: 0.8 },
    {
      source: 'lexical',
      entity: entity(348, 'Alien'),
      lexicalScore: 1,
      exactMatch: true,
    },
  ])

  assert.equal(result.length, 1)
  assert.equal(result[0].components.semantic, 0.8)
  assert.equal(result[0].components.exact, 1)
})

test('ties use stable entity identity and ignore input order', () => {
  const candidates = [
    { source: 'semantic', entity: entity(20, 'Same'), semanticScore: 0.5 },
    { source: 'semantic', entity: entity(3, 'Same'), semanticScore: 0.5 },
  ]
  const forward = rank('same mood', candidates)
  const reverse = rank('same mood', [...candidates].reverse())

  assert.deepEqual(
    forward.map(({ identity }) => identity),
    ['movie:3', 'movie:20']
  )
  assert.deepEqual(forward, reverse)
})
