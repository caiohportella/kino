import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSearchResponse,
  isSearchResponseV1,
  isSearchResponseV2,
  normalizeCreditSearchScore,
  normalizeProviderCandidate,
  normalizeSearchQuery,
  normalizeSearchRequest,
  normalizeSearchRequestV1,
  normalizeSearchRequestV2,
} from './normalize.ts'
import {
  SEARCH_SCHEMA_VERSION,
  SEARCH_SCHEMA_VERSION_V1,
  SEARCH_SCHEMA_VERSION_V2,
} from './types.ts'

test('folds accents, case, whitespace, and a terminal release year', () => {
  assert.deepEqual(normalizeSearchQuery('  Amélie   2001 '), {
    original: 'Amélie 2001',
    folded: 'amelie 2001',
    tokens: ['amelie', '2001'],
    year: 2001,
  })
})

test('normalizes empty, punctuation-only, and non-terminal years', () => {
  assert.deepEqual(normalizeSearchQuery(' \t '), {
    original: '',
    folded: '',
    tokens: [],
  })
  assert.deepEqual(normalizeSearchQuery('!!!'), {
    original: '!!!',
    folded: '',
    tokens: [],
  })
  assert.deepEqual(normalizeSearchQuery('2001: A Space Odyssey'), {
    original: '2001: A Space Odyssey',
    folded: '2001 a space odyssey',
    tokens: ['2001', 'a', 'space', 'odyssey'],
  })
})

test('accepts version one requests and rejects unsupported request schemas', () => {
  assert.deepEqual(
    normalizeSearchRequestV1({
      schemaVersion: SEARCH_SCHEMA_VERSION,
      query: '  Alien 1979 ',
      locale: 'pt-br',
      region: 'br',
      mediaTypes: ['movie', 'movie'],
      page: 2,
      limit: 10,
    }),
    {
      schemaVersion: 1,
      query: 'Alien 1979',
      locale: 'pt-BR',
      region: 'BR',
      mediaTypes: ['movie'],
      page: 2,
      limit: 10,
    }
  )

  assert.throws(
    () => normalizeSearchRequestV1({ schemaVersion: 2, query: 'Alien' }),
    (error) =>
      error.code === 'unsupported_version' &&
      error.supportedMinimum === 1 &&
      error.supportedMaximum === 1 &&
      error.upgradeRequired === true
  )
})

test('accepts additive optional response fields without changing version compatibility', () => {
  assert.equal(
    isSearchResponseV1({
      schemaVersion: 1,
      query: {
        original: 'Alien',
        folded: 'alien',
        tokens: ['alien'],
      },
      results: [],
      groups: [],
      total: 0,
      page: 1,
      limit: 20,
      futureOptionalField: { safeToIgnore: true },
    }),
    true
  )
  assert.equal(isSearchResponseV1({ schemaVersion: 2, results: [], groups: [] }), false)
})

test('validates every required response field and nested element', () => {
  const result = {
    entity: {
      id: 'movie:348',
      entityType: 'movie',
      title: 'Alien',
      tmdbId: 348,
      year: 1979,
    },
    score: 0.9,
    sources: ['catalog'],
    relationship: { personId: 'person:1', role: 'acting' },
  }
  const valid = {
    schemaVersion: 1,
    query: { original: 'Alien', folded: 'alien', tokens: ['alien'] },
    results: [result],
    groups: [{ type: 'movies', results: [result] }],
    total: 1,
    page: 1,
    limit: 20,
    nextPage: 2,
    fallback: 'none',
    additiveOptionalField: true,
  }
  assert.equal(isSearchResponseV1(valid), true)

  const invalidResponses = [
    { ...valid, query: undefined },
    { ...valid, query: { ...valid.query, tokens: ['alien', 1979] } },
    { ...valid, results: [{}] },
    { ...valid, results: [{ ...result, score: Number.NaN }] },
    { ...valid, results: [{ ...result, score: -0.1 }] },
    { ...valid, results: [{ ...result, sources: [] }] },
    { ...valid, results: [{ ...result, sources: [1] }] },
    { ...valid, results: [{ ...result, entity: { ...result.entity, id: '' } }] },
    {
      ...valid,
      results: [{ ...result, relationship: { personId: 'person:1', role: 'producing' } }],
    },
    { ...valid, groups: [{ type: 'unknown', results: [result] }] },
    { ...valid, groups: [{ type: 'movies', results: [{}] }] },
    {
      ...valid,
      groups: [
        {
          type: 'people',
          results: [{ ...result, entity: { ...result.entity, entityType: 'movie' } }],
        },
      ],
    },
    { ...valid, total: -1 },
    { ...valid, total: 1.5 },
    { ...valid, total: 0 },
    { ...valid, page: 0 },
    { ...valid, limit: 0 },
    { ...valid, nextPage: 0 },
    { ...valid, fallback: 'unexpected' },
  ]

  for (const invalid of invalidResponses) assert.equal(isSearchResponseV1(invalid), false)
})

test('normalizes provider-neutral candidate data and discards unknown fields', () => {
  assert.deepEqual(
    normalizeProviderCandidate({
      source: 'semantic',
      entity: {
        id: 'movie:194',
        entityType: 'movie',
        title: ' Amélie ',
        tmdbId: 194,
        year: 2001,
        locale: 'fr-fr',
        route: '/movie/194',
        vendorNamespace: 'must-not-escape',
      },
      semanticScore: 1.4,
      providerInternalId: 'must-not-escape',
    }),
    {
      source: 'semantic',
      entity: {
        id: 'movie:194',
        entityType: 'movie',
        title: 'Amélie',
        tmdbId: 194,
        year: 2001,
        locale: 'fr-FR',
        route: '/movie/194',
      },
      semanticScore: 1,
    }
  )
})

test('rejects malformed provider candidates', () => {
  for (const malformed of [
    null,
    {},
    { source: 'semantic', semanticScore: 0.5 },
    {
      source: 'semantic',
      semanticScore: Number.NaN,
      entity: { id: 'movie:1', entityType: 'movie', title: 'Alien' },
    },
    {
      source: 'semantic',
      semanticScore: 0.5,
      entity: { id: '', entityType: 'movie', title: 'Alien' },
    },
  ]) {
    assert.equal(normalizeProviderCandidate(malformed), null)
  }
})

test('normalizes V2 component scores at explicit bounds and defaults missing vote confidence to neutral', () => {
  assert.deepEqual(
    normalizeCreditSearchScore({
      relationshipScore: -0.2,
      semanticScore: 1.4,
      popularityScore: 0.25,
      castOrderScore: 0.75,
    }),
    {
      relationshipScore: 0,
      semanticScore: 1,
      popularityScore: 0.25,
      voteConfidenceScore: 0.5,
      castOrderScore: 0.75,
    }
  )
})

test('rejects non-finite V2 scores and ratings', () => {
  const valid = validV2Response()
  const invalidResponses = [
    {
      ...valid,
      results: [{ ...valid.results[0], score: { ...valid.results[0].score, semanticScore: Number.NaN } }],
    },
    {
      ...valid,
      results: [
        {
          ...valid.results[0],
          entity: { ...valid.results[0].entity, tmdbVoteAverage: Number.POSITIVE_INFINITY },
        },
      ],
    },
  ]

  for (const invalid of invalidResponses) assert.equal(isSearchResponseV2(invalid), false)
})

test('keeps nullable ratings independent from semantic relevance in V2 presentation contracts', () => {
  const valid = validV2Response()
  assert.equal(valid.results[0].entity.tmdbVoteAverage, null)
  assert.equal(valid.results[0].entity.kinoAverageRating, null)
  assert.equal(valid.results[0].score.semanticScore, 0.97)
  assert.equal(isSearchResponseV2(valid), true)
})

test('normalizes only V2 requests and recognizes V1 and V2 compatibility contracts', () => {
  assert.deepEqual(
    normalizeSearchRequestV2({ schemaVersion: SEARCH_SCHEMA_VERSION_V2, query: '  Alien  ' }),
    { schemaVersion: 2, query: 'Alien' }
  )
  assert.throws(() => normalizeSearchRequestV2({ schemaVersion: SEARCH_SCHEMA_VERSION_V1, query: 'Alien' }))
  assert.deepEqual(
    normalizeSearchRequest({ schemaVersion: SEARCH_SCHEMA_VERSION_V1, query: 'Alien' }),
    { schemaVersion: 1, query: 'Alien' }
  )
  assert.deepEqual(
    normalizeSearchRequest({ schemaVersion: SEARCH_SCHEMA_VERSION_V2, query: 'Alien' }),
    { schemaVersion: 2, query: 'Alien' }
  )
  assert.equal(isSearchResponse(validV2Response()), true)
  assert.equal(
    isSearchResponse({
      schemaVersion: SEARCH_SCHEMA_VERSION_V1,
      query: { original: 'Alien', folded: 'alien', tokens: ['alien'] },
      results: [],
      groups: [],
      total: 0,
      page: 1,
      limit: 20,
    }),
    true
  )
})

function validV2Response() {
  const result = {
    entity: {
      id: 'movie:348',
      entityType: 'movie',
      title: 'Alien',
      tmdbId: 348,
      tmdbVoteAverage: null,
      kinoAverageRating: null,
    },
    score: {
      relationshipScore: 0,
      semanticScore: 0.97,
      popularityScore: 0.4,
      voteConfidenceScore: 0.5,
      castOrderScore: 0,
    },
    sources: ['semantic'],
  }
  return {
    schemaVersion: SEARCH_SCHEMA_VERSION_V2,
    query: { original: 'Alien', folded: 'alien', tokens: ['alien'] },
    results: [result],
    groups: [{ type: 'movies', results: [result] }],
    total: 1,
    page: 1,
    limit: 20,
  }
}
