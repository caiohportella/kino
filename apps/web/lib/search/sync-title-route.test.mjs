import assert from 'node:assert/strict'
import test from 'node:test'

function installSyncTitleFetch(payload, requests) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const href = String(url)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    requests.push({ url: href, body })

    if (href.startsWith('https://api.themoviedb.org/3/')) return Response.json(payload)
    if (href.startsWith('https://redis.example.com/')) {
      return Response.json(
        Array.isArray(body) ? body.map(() => ({ result: 'OK' })) : { result: 'OK' }
      )
    }
    throw new Error(`Unexpected fetch: ${href}`)
  }
  return () => {
    globalThis.fetch = originalFetch
  }
}

function setSyncTitleEnv() {
  const originalTmdbKey = process.env.TMDB_API_KEY
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  process.env.TMDB_API_KEY = 'tmdb-key'
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token'
  return () => {
    if (originalTmdbKey === undefined) delete process.env.TMDB_API_KEY
    else process.env.TMDB_API_KEY = originalTmdbKey
    if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl
    if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken
  }
}

function parseIndexedDocument(requests) {
  const redisRequest = requests.find(({ url }) => url.startsWith('https://redis.example.com/'))
  assert.ok(redisRequest)
  assert.ok(Array.isArray(redisRequest.body))
  assert.equal(redisRequest.body.length, 1)
  assert.equal(redisRequest.body[0][0], 'JSON.SET')
  return JSON.parse(redisRequest.body[0][3])
}

test('sync-title request contract requires a positive TMDb ID and movie/tv type', async () => {
  const { POST } = await import('../../app/api/v1/search/sync-title/route.ts')

  const invalidRequests = [
    {},
    { tmdbId: 0, type: 'movie' },
    { tmdbId: 1, type: 'series' },
    { tmdbId: '1', type: 'movie' },
  ]

  for (const body of invalidRequests) {
    const response = await POST(
      new Request('https://kino.example/api/v1/search/sync-title', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'invalid_body' })
  }
})

test('sync-title retains title audience metrics without introducing an extra TMDb request', async () => {
  const restoreEnv = setSyncTitleEnv()
  const requests = []
  const restoreFetch = installSyncTitleFetch(
    {
      id: 11,
      title: 'Dune',
      original_title: 'Dune',
      overview: 'Spice must flow.',
      release_date: '2021-10-22',
      popularity: 455.2,
      vote_average: 8.4,
      vote_count: 30012,
      poster_path: '/dune.jpg',
      backdrop_path: '/dune-bg.jpg',
      credits: { cast: [], crew: [] },
    },
    requests
  )

  try {
    const { POST } = await import('../../app/api/v1/search/sync-title/route.ts')
    const response = await POST(
      new Request('https://kino.example/api/v1/search/sync-title', {
        method: 'POST',
        body: JSON.stringify({ tmdbId: 11, type: 'movie' }),
      })
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, indexed: true, mediaType: 'movie' })
    assert.equal(
      requests.filter(({ url }) => url.startsWith('https://api.themoviedb.org/3/movie/11')).length,
      1
    )
    assert.match(
      requests[0].url,
      /append_to_response=credits%2Cexternal_ids|append_to_response=credits,external_ids/u
    )

    assert.deepEqual(parseIndexedDocument(requests), {
      id: 'title:movie:11',
      entityType: 'movie',
      mediaType: 'movie',
      tmdbId: 11,
      title: 'Dune',
      originalTitle: 'Dune',
      aliases: '',
      localizedTitles: {},
      overview: 'Spice must flow.',
      year: 2021,
      popularity: 455.2,
      voteAverage: 8.4,
      voteCount: 30012,
      posterPath: '/dune.jpg',
      backdropPath: '/dune-bg.jpg',
    })
  } finally {
    restoreFetch()
    restoreEnv()
  }
})

test('sync-title omits missing audience metrics safely before writing the title document', async () => {
  const restoreEnv = setSyncTitleEnv()
  const requests = []
  const restoreFetch = installSyncTitleFetch(
    {
      id: 500,
      title: 'Reservoir Dogs',
      original_title: 'Reservoir Dogs',
      overview: 'Six criminals, one heist.',
      release_date: '1992-09-02',
      popularity: null,
      vote_average: null,
      vote_count: null,
      credits: { cast: [], crew: [] },
    },
    requests
  )

  try {
    const { POST } = await import('../../app/api/v1/search/sync-title/route.ts')
    const response = await POST(
      new Request('https://kino.example/api/v1/search/sync-title', {
        method: 'POST',
        body: JSON.stringify({ tmdbId: 500, type: 'movie' }),
      })
    )

    assert.equal(response.status, 200)
    const document = parseIndexedDocument(requests)
    assert.equal('popularity' in document, false)
    assert.equal('voteAverage' in document, false)
    assert.equal('voteCount' in document, false)
  } finally {
    restoreFetch()
    restoreEnv()
  }
})
