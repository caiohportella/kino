import assert from 'node:assert/strict'
import test from 'node:test'
import { runSearchPipelineV1 } from './pipeline.ts'

const person = {
  source: 'person',
  entity: {
    id: 'person:3084',
    entityType: 'person',
    title: 'Marlon Brando',
    tmdbId: 3084,
  },
  confidence: 0.97,
}

const media = (entityType, tmdbId, title, role, options = {}) => ({
  entity: {
    id: `${entityType}:${tmdbId}`,
    entityType,
    title,
    tmdbId,
  },
  role,
  ...options,
})

test('returns grouped person and expanded credit results for Marlon Brando', () => {
  const response = runSearchPipelineV1({
    request: { schemaVersion: 1, query: 'Marlon Brando', page: 1, limit: 10 },
    intentEvidence: { personConfidence: 0.97 },
    sources: [{ sourceId: 'people', candidates: [person] }],
    personExpansion: {
      person,
      credits: [
        media('series', 100, 'The Godfather Saga', 'acting', { castOrder: 1 }),
        media('movie', 238, 'The Godfather', 'acting', { castOrder: 1 }),
        media('movie', 240, 'The Godfather Part II', 'acting', { castOrder: 0 }),
      ],
    },
  })

  assert.equal(response.schemaVersion, 1)
  assert.deepEqual(
    response.groups.map((group) => [
      group.type,
      group.results.map((result) => result.entity.title),
    ]),
    [
      ['people', ['Marlon Brando']],
      ['movies', ['The Godfather Part II', 'The Godfather']],
      ['series', ['The Godfather Saga']],
    ]
  )
})

test('returns identical ordering for identical mobile and web normalized inputs', () => {
  const input = {
    request: { schemaVersion: 1, query: 'Alien 1979', page: 1, limit: 10 },
    intentEvidence: { exactTitleConfidence: 0.99 },
    sources: [
      {
        sourceId: 'catalog',
        candidates: [
          {
            source: 'semantic',
            entity: { id: 'movie:1', entityType: 'movie', title: 'Space Horror', tmdbId: 1 },
            semanticScore: 0.98,
          },
          {
            source: 'lexical',
            entity: {
              id: 'movie:348',
              entityType: 'movie',
              title: 'Alien',
              tmdbId: 348,
              year: 1979,
            },
            lexicalScore: 1,
            exactMatch: true,
            prefixMatch: true,
          },
        ],
      },
    ],
  }

  const mobileResponse = runSearchPipelineV1(structuredClone(input))
  const webResponse = runSearchPipelineV1(structuredClone(input))
  assert.deepEqual(mobileResponse, webResponse)
  assert.deepEqual(
    mobileResponse.results.map((result) => result.entity.tmdbId),
    [348, 1]
  )
})

test('returns a versioned empty response for zero candidates', () => {
  assert.deepEqual(
    runSearchPipelineV1({
      request: { schemaVersion: 1, query: '', page: 1, limit: 20 },
      intentEvidence: {},
      sources: [],
    }),
    {
      schemaVersion: 1,
      query: { original: '', folded: '', tokens: [] },
      results: [],
      groups: [],
      total: 0,
      page: 1,
      limit: 20,
      fallback: 'none',
    }
  )
})

test('trims deterministic pages after ranking and reports the next page', () => {
  const candidates = [5, 1, 4, 2, 3].map((tmdbId) => ({
    source: 'semantic',
    entity: {
      id: `movie:${tmdbId}`,
      entityType: 'movie',
      title: `Movie ${tmdbId}`,
      tmdbId,
    },
    semanticScore: 0.5,
  }))

  const response = runSearchPipelineV1({
    request: { schemaVersion: 1, query: 'same relevance', page: 2, limit: 2 },
    intentEvidence: {},
    sources: [{ sourceId: 'semantic', candidates }],
  })

  assert.deepEqual(
    response.results.map((result) => result.entity.tmdbId),
    [3, 4]
  )
  assert.equal(response.total, 5)
  assert.equal(response.nextPage, 3)
  assert.deepEqual(
    response.groups[0].results.map((result) => result.entity.tmdbId),
    [3, 4]
  )
})
