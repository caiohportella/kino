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
  })

  const response = await gateway.search(request)
  assert.equal(sawTimeout, true)
  assert.equal(response.fallback, 'provider_unavailable')
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
  })

  const response = await gateway.search({
    ...request,
    query: 'Marlon Brando',
    limit: 10,
  })
  assert.deepEqual(expandedPeople, [3084])
  assert.deepEqual(
    response.results.map((result) => result.entity.id),
    ['person:3084', 'person:2', 'movie:238']
  )
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
