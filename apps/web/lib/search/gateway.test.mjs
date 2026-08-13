import assert from 'node:assert/strict'
import test from 'node:test'

import { SEARCH_SCHEMA_VERSION } from '@kino/core/search'

import { SearchGatewayError } from './errors.ts'
import { createSearchGateway } from './gateway.ts'

const request = {
  schemaVersion: SEARCH_SCHEMA_VERSION,
  query: 'Alien',
  locale: 'en-US',
  region: 'US',
  page: 1,
  limit: 2,
  mode: 'full',
}

const autocompleteRequest = {
  ...request,
  mode: 'autocomplete',
}

const semantic = (tmdbId, title, semanticScore, options = {}) => ({
  source: 'semantic',
  semanticScore,
  entity: {
    id: `movie:${tmdbId}`,
    entityType: 'movie',
    tmdbId,
    title,
    ...options,
  },
})

const lexical = (tmdbId, title, lexicalScore, options = {}) => ({
  source: 'lexical',
  lexicalScore,
  entity: {
    id: `movie:${tmdbId}`,
    entityType: 'movie',
    tmdbId,
    title,
    ...options,
  },
})

const vectorResult = (...candidates) => ({ sourceId: 'vector', candidates })
const tmdbResult = (...candidates) => ({ sourceId: 'tmdb', candidates })

const tmdbProvider = (result = tmdbResult()) => ({
  search: async () => result,
  getPersonCredits: async () => [],
  resolvePresentation: async (entity) => entity,
})

test('uses sufficient vector candidates without calling TMDB search', async () => {
  let tmdbCalls = 0
  const gateway = createSearchGateway({
    vector: {
      search: async () => vectorResult(semantic(348, 'Alien', 0.94), semantic(679, 'Aliens', 0.9)),
    },
    tmdb: {
      ...tmdbProvider(),
      search: async () => {
        tmdbCalls += 1
        return tmdbResult()
      },
    },
    minimumVectorResults: 2,
  })

  const response = await gateway.search(request)
  assert.equal(tmdbCalls, 0)
  assert.equal(response.fallback, 'none')
  assert.deepEqual(
    response.results.map((result) => result.entity.tmdbId),
    [348, 679]
  )
})

test('autocomplete returns sufficient vector results without TMDB hydration or person expansion', async () => {
  let tmdbSearchCalls = 0
  let presentationCalls = 0
  let creditCalls = 0
  const gateway = createSearchGateway({
    vector: {
      search: async () =>
        vectorResult(semantic(1399, 'Game of Thrones', 0.96), semantic(68784, 'Game Night', 0.9)),
    },
    tmdb: {
      ...tmdbProvider(),
      search: async () => {
        tmdbSearchCalls += 1
        return tmdbResult()
      },
      getPersonCredits: async () => {
        creditCalls += 1
        return []
      },
      resolvePresentation: async (entity) => {
        presentationCalls += 1
        return entity
      },
    },
    minimumVectorResults: 2,
    autocompleteProviderTimeoutMs: 5,
  })

  const response = await gateway.search({ ...autocompleteRequest, query: 'game' })
  assert.equal(tmdbSearchCalls, 0)
  assert.equal(presentationCalls, 0)
  assert.equal(creditCalls, 0)
  assert.equal(response.fallback, 'none')
  assert.deepEqual(
    response.results.map((result) => result.entity.tmdbId),
    [1399, 68784]
  )
})

test('autocomplete falls back to TMDB search when vector results are insufficient', async () => {
  let tmdbSearchCalls = 0
  let presentationCalls = 0
  const gateway = createSearchGateway({
    vector: { search: async () => vectorResult(semantic(348, 'Alien', 0.6)) },
    tmdb: {
      ...tmdbProvider(),
      search: async () => {
        tmdbSearchCalls += 1
        return tmdbResult(lexical(348, 'Alien', 1), lexical(679, 'Aliens', 0.8))
      },
      resolvePresentation: async (entity) => {
        presentationCalls += 1
        return entity
      },
    },
    minimumVectorResults: 2,
    autocompleteProviderTimeoutMs: 5,
  })

  const response = await gateway.search({ ...autocompleteRequest, query: 'Alien' })
  assert.equal(tmdbSearchCalls, 1)
  assert.equal(presentationCalls, 0)
  assert.equal(response.results.length > 0, true)
})

test('autocomplete uses the shorter provider timeout', async () => {
  let sawTimeout = false
  const gateway = createSearchGateway({
    vector: {
      search: async (_request, signal) =>
        new Promise((_resolve, reject) => {
          const safetyTimer = setTimeout(() => reject(new Error('timeout signal did not fire')), 50)
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(safetyTimer)
              sawTimeout = signal.reason?.name === 'TimeoutError'
              reject(signal.reason)
            },
            { once: true }
          )
        }),
    },
    tmdb: tmdbProvider(tmdbResult(lexical(348, 'Alien', 1))),
    autocompleteProviderTimeoutMs: 5,
    minimumVectorResults: 2,
  })

  const response = await gateway.search({ ...autocompleteRequest, query: 'Alien' })
  assert.equal(sawTimeout, true)
  assert.equal(response.results.map((result) => result.entity.tmdbId)[0], 348)
})

test('supplements weak vector candidates with TMDB before shared ranking and deduplication', async () => {
  const gateway = createSearchGateway({
    vector: { search: async () => vectorResult(semantic(348, 'Alien', 0.6)) },
    tmdb: tmdbProvider(
      tmdbResult(lexical(348, 'Alien', 1, { popularity: 100 }), lexical(679, 'Aliens', 0.8))
    ),
    minimumVectorResults: 2,
  })

  const response = await gateway.search(request)
  assert.equal(response.fallback, 'supplemented')
  assert.equal(response.total, 2)
  assert.deepEqual(
    response.results.map((result) => [result.entity.tmdbId, result.sources]),
    [
      [348, ['tmdb', 'vector']],
      [679, ['tmdb']],
    ]
  )
})

test('uses TMDB-only fallback when vector times out or is not configured', async () => {
  const fallback = tmdbProvider(tmdbResult(lexical(348, 'Alien', 1)))
  for (const vector of [
    { search: async () => Promise.reject(new DOMException('timed out', 'AbortError')) },
    undefined,
  ]) {
    const gateway = createSearchGateway({ vector, tmdb: fallback })
    const response = await gateway.search(request)
    assert.equal(response.fallback, 'provider_unavailable')
    assert.deepEqual(
      response.results.map((result) => result.entity.tmdbId),
      [348]
    )
  }
})

test('returns a successful zero-result TMDB fallback response', async () => {
  const gateway = createSearchGateway({
    vector: undefined,
    tmdb: tmdbProvider(tmdbResult()),
  })

  const response = await gateway.search(request)
  assert.equal(response.total, 0)
  assert.deepEqual(response.results, [])
  assert.equal(response.fallback, 'provider_unavailable')
})

test('enforces a bounded provider timeout before using TMDB fallback', async () => {
  let sawTimeout = false
  const events = []
  const gateway = createSearchGateway({
    vector: {
      search: async (_request, signal) =>
        new Promise((_resolve, reject) => {
          const safetyTimer = setTimeout(() => reject(new Error('timeout signal did not fire')), 50)
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(safetyTimer)
              sawTimeout = signal.reason?.name === 'TimeoutError'
              reject(signal.reason)
            },
            { once: true }
          )
        }),
    },
    tmdb: tmdbProvider(tmdbResult(lexical(348, 'Alien', 1))),
    providerTimeoutMs: 5,
    telemetry: { emit: (event) => events.push(event) },
  })

  const response = await gateway.search(request)
  assert.equal(sawTimeout, true)
  assert.equal(response.fallback, 'provider_unavailable')
  assert.equal(events.find((event) => event.stage === 'vector')?.outcome, 'timeout')
})

test('returns typed temporary unavailability when vector and TMDB both fail', async () => {
  const gateway = createSearchGateway({
    vector: { search: async () => Promise.reject(new Error('vector secret detail')) },
    tmdb: {
      ...tmdbProvider(),
      search: async () => Promise.reject(new Error('tmdb secret detail')),
    },
  })

  await assert.rejects(
    gateway.search(request),
    (error) =>
      error instanceof SearchGatewayError &&
      error.status === 503 &&
      assert.deepEqual(error.body, {
        error: { code: 'temporary_unavailable', retryable: true },
      }) === undefined &&
      !JSON.stringify(error.body).includes('secret detail')
  )
})

test('expands only the highest-confidence person through the shared pipeline', async () => {
  const expandedPeople = []
  const events = []
  const brando = {
    source: 'person',
    confidence: 0.99,
    entity: {
      id: 'person:3084',
      entityType: 'person',
      tmdbId: 3084,
      title: 'Marlon Brando',
    },
  }
  const otherPerson = {
    source: 'person',
    confidence: 0.9,
    entity: {
      id: 'person:2',
      entityType: 'person',
      tmdbId: 2,
      title: 'Brando Other',
    },
  }
  const gateway = createSearchGateway({
    vector: undefined,
    tmdb: {
      ...tmdbProvider(tmdbResult(otherPerson, brando)),
      getPersonCredits: async (personId) => {
        expandedPeople.push(personId)
        return [
          {
            entity: {
              id: 'movie:238',
              entityType: 'movie',
              tmdbId: 238,
              title: 'The Godfather',
            },
            role: 'acting',
            castOrder: 0,
          },
        ]
      },
    },
    telemetry: { emit: (event) => events.push(event) },
  })

  const response = await gateway.search({
    ...request,
    query: 'Marlon Brando',
    limit: 10,
  })
  assert.deepEqual(expandedPeople, [3084])
  assert.equal(events.find((event) => event.stage === 'person_expansion')?.expansionOccurred, true)
  assert.deepEqual(
    response.results.map((result) => result.entity.id),
    ['person:3084', 'person:2', 'movie:238']
  )
})

test('expands a sufficient vector person result without requiring TMDB supplementation', async () => {
  const expandedPeople = []
  const person = {
    source: 'person',
    confidence: 0.97,
    entity: {
      id: 'person:3084',
      entityType: 'person',
      tmdbId: 3084,
      title: 'Marlon Brando',
    },
  }
  const gateway = createSearchGateway({
    vector: { search: async () => vectorResult(person) },
    tmdb: {
      ...tmdbProvider(),
      getPersonCredits: async (personId) => {
        expandedPeople.push(personId)
        return []
      },
    },
    minimumVectorResults: 1,
  })

  await gateway.search({ ...request, query: 'Marlon Brando' })
  assert.deepEqual(expandedPeople, [3084])
})

test('retrieves the complete page window while shared core solely paginates page two', async () => {
  const vectorRequests = []
  const tmdbRequests = []
  const candidates = [
    semantic(1, 'Alien One', 0.4),
    semantic(2, 'Alien Two', 0.39),
    semantic(3, 'Alien Three', 0.38),
    semantic(4, 'Alien Four', 0.37),
  ]
  const gateway = createSearchGateway({
    vector: {
      search: async (providerRequest) => {
        vectorRequests.push(providerRequest)
        return vectorResult(...candidates)
      },
    },
    tmdb: {
      ...tmdbProvider(),
      search: async (providerRequest) => {
        tmdbRequests.push(providerRequest)
        return tmdbResult(
          ...candidates.map((candidate) => ({
            ...candidate,
            source: 'lexical',
            lexicalScore: 0.8,
          }))
        )
      },
    },
    minimumVectorResults: 1,
  })

  const response = await gateway.search({ ...request, page: 2, limit: 2 })
  assert.equal(vectorRequests[0].topK, 8)
  assert.equal(tmdbRequests[0].page, 1)
  assert.equal(tmdbRequests[0].limit, 4)
  assert.deepEqual(
    response.results.map((result) => result.entity.tmdbId),
    [3, 4]
  )
})

test('does not truncate page two at the former 50-candidate retrieval cap', async () => {
  const candidates = Array.from({ length: 100 }, (_, index) =>
    semantic(index + 1, `Alien ${index + 1}`, 0.99 - index / 1_000)
  )
  let topK
  const gateway = createSearchGateway({
    vector: {
      search: async (providerRequest) => {
        topK = providerRequest.topK
        return vectorResult(...candidates.slice(0, providerRequest.topK))
      },
    },
    tmdb: tmdbProvider(),
    minimumVectorResults: 1,
  })

  const response = await gateway.search({ ...request, page: 2, limit: 50 })
  assert.equal(topK, 200)
  assert.equal(response.results.length, 50)
})

test('retrieves enough vector and TMDB candidates for a complete third core page', async () => {
  const weakVector = Array.from({ length: 60 }, (_, index) =>
    semantic(index + 1, `Alien ${index + 1}`, 0.2)
  )
  const lexicalCandidates = Array.from({ length: 60 }, (_, index) =>
    lexical(index + 1, `Alien ${index + 1}`, 0.8)
  )
  let topK
  let tmdbLimit
  const gateway = createSearchGateway({
    vector: {
      search: async (providerRequest) => {
        topK = providerRequest.topK
        return vectorResult(...weakVector.slice(0, providerRequest.topK))
      },
    },
    tmdb: {
      ...tmdbProvider(),
      search: async (providerRequest) => {
        tmdbLimit = providerRequest.limit
        return tmdbResult(...lexicalCandidates.slice(0, providerRequest.limit))
      },
    },
    minimumVectorResults: 1,
  })

  const response = await gateway.search({ ...request, page: 3, limit: 20 })
  assert.equal(topK, 120)
  assert.equal(tmdbLimit, 60)
  assert.equal(response.results.length, 20)
})

test('rejects oversized direct gateway windows before invoking providers', async () => {
  let providerCalls = 0
  const gateway = createSearchGateway({
    vector: {
      search: async () => {
        providerCalls += 1
        return vectorResult()
      },
    },
    tmdb: {
      ...tmdbProvider(),
      search: async () => {
        providerCalls += 1
        return tmdbResult()
      },
    },
  })

  await assert.rejects(
    gateway.search({ ...request, page: 11, limit: 50 }),
    (error) => error instanceof SearchGatewayError && error.body.error.code === 'invalid_request'
  )
  assert.equal(providerCalls, 0)
})

test('propagates caller cancellation instead of treating it as provider failure', async () => {
  const controller = new AbortController()
  const reason = new DOMException('caller cancelled', 'AbortError')
  const gateway = createSearchGateway({
    vector: {
      search: async (_request, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    },
    tmdb: tmdbProvider(tmdbResult(lexical(348, 'Alien', 1))),
  })

  const pending = gateway.search(request, controller.signal)
  controller.abort(reason)
  await assert.rejects(pending, (error) => error === reason)
})

test('preserves shared-core order while resolving localized presentation concurrently', async () => {
  const completions = []
  const gateway = createSearchGateway({
    vector: {
      search: async () => vectorResult(semantic(679, 'Aliens', 0.99), semantic(348, 'Alien', 0.2)),
    },
    tmdb: {
      ...tmdbProvider(),
      resolvePresentation: async (entity) => {
        await new Promise((resolve) => setTimeout(resolve, entity.tmdbId === 679 ? 8 : 1))
        completions.push(entity.tmdbId)
        return { ...entity, title: `${entity.title} localized` }
      },
    },
    minimumVectorResults: 2,
  })

  const first = await gateway.search(request)
  const second = await gateway.search(request)
  assert.deepEqual(completions, [348, 679, 348, 679])
  assert.deepEqual(
    first.results.map((result) => [result.entity.tmdbId, result.entity.title]),
    [
      [679, 'Aliens localized'],
      [348, 'Alien localized'],
    ]
  )
  assert.deepEqual(second, first)
})

test('returns a typed failure instead of an unverified prelocalized candidate', async () => {
  const gateway = createSearchGateway({
    vector: {
      search: async () => vectorResult(semantic(348, 'Alien', 0.94)),
    },
    tmdb: {
      ...tmdbProvider(),
      resolvePresentation: async () => Promise.reject(new Error('presentation failed')),
    },
    minimumVectorResults: 1,
  })

  await assert.rejects(
    gateway.search(request),
    (error) => error instanceof SearchGatewayError && error.status === 503
  )
})

test('records sanitized provider-stage metrics without query or provider errors', async () => {
  const events = []
  let now = 0
  const gateway = createSearchGateway({
    vector: { search: async () => vectorResult(semantic(348, 'Alien', 0.2)) },
    tmdb: tmdbProvider(tmdbResult(lexical(348, 'Alien', 1))),
    minimumVectorResults: 2,
    telemetry: { emit: (event) => events.push(event) },
    now: () => (now += 5),
  })

  await gateway.search(request)
  assert.deepEqual(
    events.map((event) => event.type),
    [
      'search_gateway_provider_stage',
      'search_gateway_provider_stage',
      'search_gateway_provider_stage',
      'search_gateway_provider_stage',
    ]
  )
  assert.deepEqual(
    events.map(({ stage, outcome }) => [stage, outcome]),
    [
      ['vector', 'success'],
      ['tmdb_search', 'success'],
      ['person_expansion', 'skipped'],
      ['tmdb_presentation', 'success'],
    ]
  )
  assert.equal(events[1].supplementationCount, 1)
  assert.equal(events[2].expansionOccurred, false)
  assert.equal(events[3].resultCount, 1)
  assert.doesNotMatch(JSON.stringify(events), /Alien|presentation failed|server-secret/u)
})

test('infers presentation region from locale when the request omits region', async () => {
  const contexts = []
  const gateway = createSearchGateway({
    vector: {
      search: async () => vectorResult(semantic(348, 'Alien', 0.94)),
    },
    tmdb: {
      ...tmdbProvider(),
      resolvePresentation: async (entity, context) => {
        contexts.push(context)
        return entity
      },
    },
    minimumVectorResults: 1,
  })

  await gateway.search({
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query: 'Alien',
    locale: 'pt-BR',
    limit: 1,
  })
  assert.deepEqual(contexts, [{ locale: 'pt-BR', region: 'BR' }])
})

test('uses fresh and stale complete relationship records without blocking on TMDB credits', async () => {
  const person = {
    source: 'person',
    confidence: 1,
    entity: { id: 'person:3084', entityType: 'person', tmdbId: 3084, title: 'Marlon Brando' },
  }
  const credit = {
    entity: { id: 'movie:238', entityType: 'movie', tmdbId: 238, title: 'The Godfather' },
    role: 'acting',
    castOrder: 0,
  }

  for (const state of ['fresh_complete', 'stale_complete']) {
    let tmdbCreditCalls = 0
    const gateway = createSearchGateway({
      tmdb: {
        ...tmdbProvider(tmdbResult(person)),
        getPersonCredits: async () => {
          tmdbCreditCalls += 1
          return []
        },
      },
      relationships: {
        get: async () => ({
          state,
          record: {
            schemaVersion: 1,
            personId: 3084,
            aliases: ['Marlon Brando'],
            knownForDepartment: 'Acting',
            movieCredits: [credit],
            tvCredits: [],
            complete: true,
            updatedAt: '2026-07-20T00:00:00.000Z',
          },
        }),
        set: async () => undefined,
        scheduleRefresh: async () => undefined,
      },
    })

    const response = await gateway.search({ ...request, query: 'Marlon Brando', limit: 10 })
    assert.equal(tmdbCreditCalls, 0)
    assert.equal(
      response.results.some((result) => result.entity.id === 'movie:238'),
      true
    )
  }
})

test('supplements missing and incomplete relationship records through TMDB and writes a bounded record', async () => {
  const person = {
    source: 'person',
    confidence: 1,
    entity: { id: 'person:3084', entityType: 'person', tmdbId: 3084, title: 'Marlon Brando' },
  }
  for (const cached of [{ state: 'missing' }, { state: 'incomplete', record: {} }]) {
    const writes = []
    let creditCalls = 0
    const gateway = createSearchGateway({
      tmdb: {
        ...tmdbProvider(tmdbResult(person)),
        getPersonCredits: async () => {
          creditCalls += 1
          return [
            {
              entity: {
                id: 'movie:238',
                entityType: 'movie',
                tmdbId: 238,
                title: 'The Godfather',
              },
              role: 'acting',
            },
          ]
        },
      },
      relationships: {
        get: async () => cached,
        set: async (value) => writes.push(value),
        scheduleRefresh: async () => undefined,
      },
      now: () => Date.parse('2026-07-29T00:00:00.000Z'),
    })
    const response = await gateway.search({ ...request, query: 'Marlon Brando', limit: 10 })
    assert.equal(creditCalls, 1)
    assert.equal(writes.length, 1)
    assert.equal(writes[0].complete, true)
    assert.equal(
      response.results.some((result) => result.entity.id === 'movie:238'),
      true
    )
  }
})

test('degrades relationship expansion failure without changing ordinary result order', async () => {
  const person = {
    source: 'person',
    confidence: 1,
    entity: { id: 'person:3084', entityType: 'person', tmdbId: 3084, title: 'Marlon Brando' },
  }
  const title = lexical(238, 'The Godfather', 0.8)
  const gateway = createSearchGateway({
    tmdb: {
      ...tmdbProvider(tmdbResult(person, title)),
      getPersonCredits: async () => Promise.reject(new Error('credits unavailable')),
    },
    relationships: {
      get: async () => ({ state: 'missing' }),
      set: async () => undefined,
      scheduleRefresh: async () => undefined,
    },
  })

  const response = await gateway.search({ ...request, query: 'Marlon Brando', limit: 10 })
  assert.deepEqual(
    response.results.map((result) => result.entity.id),
    ['person:3084', 'movie:238']
  )
})

test('serializes requested V2 responses with structured relevance and separate TMDB rating', async () => {
  const gateway = createSearchGateway({
    tmdb: tmdbProvider(
      tmdbResult(lexical(238, 'The Godfather', 1, { tmdbVoteAverage: 8.7, voteCount: 1000 }))
    ),
  })
  const response = await gateway.search({ ...request, schemaVersion: 2, query: 'The Godfather' })
  assert.equal(response.schemaVersion, 2)
  assert.equal(response.results[0].entity.tmdbVoteAverage, 8.7)
  assert.deepEqual(Object.keys(response.results[0].score).sort(), [
    'castOrderScore',
    'popularityScore',
    'relationshipScore',
    'semanticScore',
    'voteConfidenceScore',
  ])
})

test('merges duplicate title hits and appends user search results', async () => {
  const gateway = createSearchGateway({
    vector: {
      search: async () => vectorResult(semantic(238, 'The Godfather', 0.97)),
    },
    users: {
      search: async () => ({
        results: [
          {
            entity: {
              id: 'user:alice',
              entityType: 'user',
              title: 'Alice Example',
              route: '/alice',
            },
            score: 0.91,
            sources: ['user-db'],
          },
        ],
      }),
    },
    tmdb: tmdbProvider(tmdbResult(lexical(238, 'The Godfather', 1))),
    minimumVectorResults: 1,
  })

  const response = await gateway.search({ ...request, query: 'Godfather', limit: 10 })
  assert.equal(response.total, 2)
  assert.deepEqual(
    response.results.map((result) => result.entity.id),
    ['movie:238', 'user:alice']
  )
  assert.deepEqual(
    response.groups.map((group) => group.type),
    ['movies', 'users']
  )
})
