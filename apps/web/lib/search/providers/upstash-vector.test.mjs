import assert from 'node:assert/strict'
import test from 'node:test'

import { createUpstashVectorProvider } from './upstash-vector.ts'

const fullUpstashResult = {
  id: 'movie:238',
  score: 0.942,
  vector: [0.1, 0.2, 0.3],
  sparseVector: { indices: [1, 9], values: [0.4, 0.8] },
  data: 'provider-owned searchable text',
  metadata: {
    entityType: 'movie',
    tmdbId: 238,
    title: 'The Godfather',
    overview: 'An organized crime dynasty changes hands.',
    releaseDate: '1972-03-14',
    locale: 'en-US',
    posterPath: '/poster.jpg',
    popularity: 170.5,
    voteCount: 20_798,
    alternativeTitles: [],
    genres: ['Crime', 'Drama'],
    keywords: ['mafia'],
    people: [],
    indexVersion: 1,
    contentHash: 'hash-owned-by-indexing',
  },
}

test('normalizes a full Upstash query response without leaking provider fields', async () => {
  const requests = []
  const provider = createUpstashVectorProvider({
    url: 'https://vector.example.test',
    token: 'server-secret',
    fetch: async (url, init) => {
      requests.push({ url, init })
      return Response.json({ result: [fullUpstashResult] })
    },
  })

  const result = await provider.search({ query: 'crime family', topK: 12, locale: 'en-US' })

  assert.deepEqual(result, {
    sourceId: 'vector',
    candidates: [
      {
        source: 'semantic',
        semanticScore: 0.942,
        localeRelevance: 1,
        entity: {
          id: 'movie:238',
          entityType: 'movie',
          tmdbId: 238,
          title: 'The Godfather',
          summary: 'An organized crime dynasty changes hands.',
          year: 1972,
          locale: 'en-US',
          imageUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          popularity: 170.5,
          voteCount: 20_798,
        },
      },
    ],
  })
  assert.equal(JSON.stringify(result).includes('vector'), true)
  assert.equal(JSON.stringify(result).includes('sparseVector'), false)
  assert.equal(JSON.stringify(result).includes('provider-owned searchable text'), false)
  assert.equal(JSON.stringify(result).includes('contentHash'), false)
  assert.equal(requests[0].url, 'https://vector.example.test/query-data')
  assert.equal(requests[0].init.headers.authorization, 'Bearer server-secret')
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    data: 'crime family',
    topK: 12,
    includeMetadata: true,
    filter: "locale = 'en-US'",
  })
})

test('uses indexed locale metadata to partition region-only retrieval', async () => {
  let body
  const provider = createUpstashVectorProvider({
    url: 'https://vector.example.test',
    token: 'server-secret',
    fetch: async (_url, init) => {
      body = JSON.parse(init.body)
      return Response.json({ result: [] })
    },
  })

  await provider.search({ query: 'crime', topK: 10, region: 'BR' })
  assert.equal(body.filter, "locale GLOB '*-BR'")
})

test('normalizes vector people as person candidates that can drive person intent', async () => {
  const provider = createUpstashVectorProvider({
    url: 'https://vector.example.test',
    token: 'server-secret',
    fetch: async () =>
      Response.json({
        result: [
          {
            ...fullUpstashResult,
            id: 'person:3084',
            score: 0.97,
            metadata: {
              ...fullUpstashResult.metadata,
              entityType: 'person',
              tmdbId: 3084,
              title: undefined,
              name: 'Marlon Brando',
            },
          },
        ],
      }),
  })

  const result = await provider.search({ query: 'Marlon Brando', topK: 10 })
  assert.deepEqual(result.candidates[0], {
    source: 'person',
    confidence: 0.97,
    entity: {
      id: 'person:3084',
      entityType: 'person',
      tmdbId: 3084,
      title: 'Marlon Brando',
      summary: 'An organized crime dynasty changes hands.',
      year: 1972,
      locale: 'en-US',
      imageUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      popularity: 170.5,
      voteCount: 20_798,
    },
  })
})

test('sends locale and requested media metadata filters to Upstash', async () => {
  let body
  const provider = createUpstashVectorProvider({
    url: 'https://vector.example.test',
    token: 'server-secret',
    fetch: async (_url, init) => {
      body = JSON.parse(init.body)
      return Response.json({ result: [] })
    },
  })

  await provider.search({
    query: 'crime',
    topK: 10,
    locale: 'pt-BR',
    region: 'BR',
    mediaTypes: ['movie'],
  })

  assert.equal(body.filter, "locale = 'pt-BR' AND entityType IN ('movie', 'person')")
})

test('drops malformed metadata instead of exposing a partial provider candidate', async () => {
  const provider = createUpstashVectorProvider({
    url: 'https://vector.example.test',
    token: 'server-secret',
    fetch: async () =>
      Response.json({
        result: [
          fullUpstashResult,
          {
            ...fullUpstashResult,
            id: 'bad',
            metadata: { ...fullUpstashResult.metadata, tmdbId: 'not-a-number' },
          },
        ],
      }),
  })

  const result = await provider.search({ query: 'crime family', topK: 12 })
  assert.equal(result.candidates.length, 1)
  assert.equal(result.degraded, true)
})

test('passes caller cancellation to the Upstash request', async () => {
  const controller = new AbortController()
  const provider = createUpstashVectorProvider({
    url: 'https://vector.example.test',
    token: 'server-secret',
    fetch: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      }),
  })

  const pending = provider.search({ query: 'crime family', topK: 12 }, controller.signal)
  const reason = new DOMException('cancelled', 'AbortError')
  controller.abort(reason)
  await assert.rejects(pending, (error) => error === reason)
})
