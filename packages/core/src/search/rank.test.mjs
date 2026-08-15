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

const userEntity = (id, title, options = {}) => ({
  id,
  entityType: 'user',
  title,
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

test('mixed intrinsic scores preserve relationship metadata', () => {
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

  const results = rank('Marlon Brando', candidates)

  assert.deepEqual(
    results.map(({ entity: result }) => result.tmdbId),
    [238, 90]
  )
  assert.deepEqual(results[0].relationship, {
    personId: 'person:3084',
    role: 'acting',
  })
  assert.ok(results[0].score > results[1].score)
})

test('audience-recognized Duna wins within the strong title band', () => {
  const results = rank('duna', [
    {
      source: 'lexical',
      entity: entity(2018, 'Duna', { year: 2018, voteCount: 100, popularity: 2 }),
      lexicalScore: 1,
      exactMatch: true,
    },
    {
      source: 'lexical',
      entity: entity(2021, 'Duna', { year: 2021, voteCount: 30_000, popularity: 500 }),
      lexicalScore: 0.92,
      prefixMatch: true,
    },
  ])

  assert.equal(results[0].entity.tmdbId, 2021)
  assert.ok(
    results.every((result, index) => index === 0 || result.score <= results[index - 1].score)
  )
})

test('audience-recognized Obsession wins over an obscure same-tier exact title', () => {
  const results = rank('obsession', [
    {
      source: 'lexical',
      entity: entity(1976, 'Obsession', { voteCount: 80, popularity: 1 }),
      lexicalScore: 1,
      exactMatch: true,
    },
    {
      source: 'lexical',
      entity: entity(2019, 'Obsession', { voteCount: 12_000, popularity: 120 }),
      lexicalScore: 0.95,
      prefixMatch: true,
    },
  ])

  assert.equal(results[0].entity.tmdbId, 2019)
  assert.ok(
    results.every((result, index) => index === 0 || result.score <= results[index - 1].score)
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

test('unrelated blockbuster does not beat a relevant Godfather title', () => {
  const results = rank('godfather', [
    {
      source: 'semantic',
      entity: entity(1, 'The Godfather', { voteCount: 2_000 }),
      semanticScore: 0.8,
    },
    {
      source: 'semantic',
      entity: entity(2, 'Unrelated Blockbuster', {
        voteCount: 500_000,
        popularity: 1_000_000,
      }),
      semanticScore: 0.1,
    },
  ])

  assert.equal(results[0].entity.title, 'The Godfather')
})

test('popular weak fuzzy result does not beat a strong prefix result', () => {
  const results = rank('oppen', [
    {
      source: 'lexical',
      entity: entity(3, 'Oppenheimer', { voteCount: 300 }),
      lexicalScore: 0.9,
      prefixMatch: true,
    },
    {
      source: 'semantic',
      entity: entity(4, 'Popular Unrelated Film', {
        voteCount: 500_000,
        popularity: 1_000_000,
      }),
      semanticScore: 0.35,
    },
  ])

  assert.equal(results[0].entity.title, 'Oppenheimer')
})

test('vote count beats a high rating when text evidence is comparable', () => {
  const results = rank('dune', [
    {
      source: 'lexical',
      entity: entity(5, 'Dune', {
        voteCount: 12,
        popularity: 10,
        tmdbVoteAverage: 9.2,
      }),
      lexicalScore: 0.95,
      exactMatch: true,
    },
    {
      source: 'lexical',
      entity: entity(6, 'Dune', {
        voteCount: 30_000,
        popularity: 10,
        tmdbVoteAverage: 7.4,
      }),
      lexicalScore: 0.94,
      prefixMatch: true,
    },
  ])

  assert.equal(results[0].entity.tmdbId, 6)
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

test('uses intrinsic scores for mixed title and relationship movies', () => {
  const results = rank('dexter', [
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
      entity: entity(1405, 'Dexter', { popularity: 4 }),
      semanticScore: 0.95,
    },
    {
      source: 'lexical',
      entity: entity(999, 'Dexter'),
      lexicalScore: 1,
      exactMatch: true,
    },
  ])

  assert.equal(results[0].entity.tmdbId, 999)
  assert.ok(results[0].score > results[1].score)
  assert.equal(results[1].entity.tmdbId, 1405)
  assert.deepEqual(results[1].relationship, { personId: 'person:6487', role: 'acting' })
  assert.ok(
    results.every((result, index) => index === 0 || result.score <= results[index - 1].score)
  )
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

test('users keep the existing stable identity path', () => {
  const candidates = [
    { source: 'semantic', entity: userEntity('zebra', 'Same'), semanticScore: 0.5 },
    { source: 'semantic', entity: userEntity('alpha', 'Same'), semanticScore: 0.5 },
  ]
  const forward = rank('same mood', candidates)
  const reverse = rank('same mood', [...candidates].reverse())

  assert.deepEqual(
    forward.map(({ identity }) => identity),
    ['user:alpha', 'user:zebra']
  )
  assert.deepEqual(forward, reverse)
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
