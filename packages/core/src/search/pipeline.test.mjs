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

test('does not expand unqualified Sofia Coppola relationship evidence', () => {
  const sofia = {
    source: 'person',
    entity: { id: 'person:17609', entityType: 'person', title: 'Sofia Coppola', tmdbId: 17609 },
    confidence: 0.49,
  }
  const response = runSearchPipelineV1({
    request: { schemaVersion: 1, query: 'movies directed by Sofia Coppola', page: 1, limit: 10 },
    intentEvidence: {},
    sources: [{ sourceId: 'people', candidates: [sofia] }],
    personExpansion: { person: sofia, credits: [media('movie', 426, 'Lost in Translation', 'directing')] },
  })

  assert.deepEqual(response.results.map((result) => result.entity.tmdbId), [17609])
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

test('enforces request media types before fusion and ranking', () => {
  const response = runSearchPipelineV1({
    request: {
      schemaVersion: 1,
      query: 'space',
      mediaTypes: ['movie'],
      page: 1,
      limit: 10,
    },
    intentEvidence: {},
    sources: [
      {
        sourceId: 'catalog',
        candidates: [
          {
            source: 'semantic',
            entity: { id: 'series:1', entityType: 'series', title: 'Space Show', tmdbId: 1 },
            semanticScore: 1,
          },
          {
            source: 'semantic',
            entity: { id: 'movie:2', entityType: 'movie', title: 'Space Film', tmdbId: 2 },
            semanticScore: 0.5,
          },
        ],
      },
    ],
  })

  assert.deepEqual(
    response.results.map((result) => [result.entity.entityType, result.entity.tmdbId]),
    [['movie', 2]]
  )
  assert.deepEqual(
    response.groups.map((group) => group.type),
    ['movies']
  )
})

test('paginates each canonical group so a small limit preserves every result kind', () => {
  const sources = [
    {
      sourceId: 'mixed',
      candidates: [
        {
          source: 'person',
          entity: { id: 'person:2', entityType: 'person', title: 'Person Two', tmdbId: 2 },
          confidence: 0.8,
        },
        {
          source: 'person',
          entity: { id: 'person:1', entityType: 'person', title: 'Person One', tmdbId: 1 },
          confidence: 0.9,
        },
        {
          source: 'semantic',
          entity: { id: 'movie:2', entityType: 'movie', title: 'Movie Two', tmdbId: 2 },
          semanticScore: 0.8,
        },
        {
          source: 'semantic',
          entity: { id: 'movie:1', entityType: 'movie', title: 'Movie One', tmdbId: 1 },
          semanticScore: 0.9,
        },
        {
          source: 'semantic',
          entity: { id: 'series:2', entityType: 'series', title: 'Series Two', tmdbId: 2 },
          semanticScore: 0.8,
        },
        {
          source: 'semantic',
          entity: { id: 'series:1', entityType: 'series', title: 'Series One', tmdbId: 1 },
          semanticScore: 0.9,
        },
      ],
    },
  ]
  const input = {
    request: { schemaVersion: 1, query: 'mixed', page: 1, limit: 1 },
    intentEvidence: {},
    sources,
  }

  const firstPage = runSearchPipelineV1(input)
  assert.deepEqual(
    firstPage.groups.map((group) => [group.type, group.results[0].entity.tmdbId]),
    [
      ['people', 1],
      ['movies', 1],
      ['series', 1],
    ]
  )
  assert.deepEqual(
    firstPage.results.map((result) => [result.entity.entityType, result.entity.tmdbId]),
    [
      ['person', 1],
      ['movie', 1],
      ['series', 1],
    ]
  )
  assert.equal(firstPage.total, 6)
  assert.equal(firstPage.nextPage, 2)

  const reversedPage = runSearchPipelineV1({
    ...input,
    sources: [{ ...sources[0], candidates: [...sources[0].candidates].reverse() }],
  })
  assert.deepEqual(firstPage, reversedPage)

  const secondPage = runSearchPipelineV1({
    ...input,
    request: { ...input.request, page: 2 },
  })
  assert.deepEqual(
    secondPage.groups.map((group) => [group.type, group.results[0].entity.tmdbId]),
    [
      ['people', 2],
      ['movies', 2],
      ['series', 2],
    ]
  )
  assert.equal('nextPage' in secondPage, false)
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
