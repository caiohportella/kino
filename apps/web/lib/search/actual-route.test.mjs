import assert from 'node:assert/strict'
import test from 'node:test'

import { SEARCH_SCHEMA_VERSION } from '@kino/core/search'

test('the composed route preserves caller cancellation through every server boundary', async () => {
  const originalFetch = globalThis.fetch
  const originalConsoleInfo = console.info
  const originalTmdbKey = process.env.TMDB_API_KEY
  const originalVectorUrl = process.env.UPSTASH_VECTOR_REST_URL
  const originalVectorToken = process.env.UPSTASH_VECTOR_REST_TOKEN
  process.env.TMDB_API_KEY = 'server-tmdb-key'
  delete process.env.UPSTASH_VECTOR_REST_URL
  delete process.env.UPSTASH_VECTOR_REST_TOKEN
  console.info = () => undefined
  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      const safetyTimer = setTimeout(() => reject(new Error('cancellation did not arrive')), 50)
      init.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(safetyTimer)
          reject(init.signal.reason)
        },
        { once: true }
      )
    })

  try {
    const { POST } = await import('../../app/api/v1/search/route.ts')
    const controller = new AbortController()
    const reason = new DOMException('caller cancelled', 'AbortError')
    const pending = POST(
      new Request('https://kino.example/api/v1/search', {
        method: 'POST',
        body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
        signal: controller.signal,
      })
    )
    controller.abort(reason)
    await assert.rejects(pending, (error) => error === reason)
  } finally {
    globalThis.fetch = originalFetch
    console.info = originalConsoleInfo
    if (originalTmdbKey === undefined) delete process.env.TMDB_API_KEY
    else process.env.TMDB_API_KEY = originalTmdbKey
    if (originalVectorUrl === undefined) delete process.env.UPSTASH_VECTOR_REST_URL
    else process.env.UPSTASH_VECTOR_REST_URL = originalVectorUrl
    if (originalVectorToken === undefined) delete process.env.UPSTASH_VECTOR_REST_TOKEN
    else process.env.UPSTASH_VECTOR_REST_TOKEN = originalVectorToken
  }
})

test('the composed route emits sanitized telemetry and no broad CORS header', async () => {
  const originalFetch = globalThis.fetch
  const originalConsoleInfo = console.info
  const originalTmdbKey = process.env.TMDB_API_KEY
  const originalVectorUrl = process.env.UPSTASH_VECTOR_REST_URL
  const originalVectorToken = process.env.UPSTASH_VECTOR_REST_TOKEN
  const logs = []
  process.env.TMDB_API_KEY = 'server-tmdb-key'
  delete process.env.UPSTASH_VECTOR_REST_URL
  delete process.env.UPSTASH_VECTOR_REST_TOKEN
  globalThis.fetch = async () =>
    Response.json({ page: 1, results: [], total_pages: 0, total_results: 0 })
  console.info = (...values) => logs.push(values)

  try {
    const { POST } = await import('../../app/api/v1/search/route.ts')
    const response = await POST(
      new Request('https://kino.example/api/v1/search', {
        method: 'POST',
        headers: {
          authorization: 'Bearer request-secret',
          cookie: 'session=request-secret',
        },
        body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Secret Movie Query' }),
      })
    )
    assert.equal(response.status, 200)
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/u)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
    assert.equal(logs.length, 1)
    assert.match(logs[0][0], /"type":"search_gateway_request"/u)
    assert.doesNotMatch(
      JSON.stringify(logs),
      /Secret Movie Query|request-secret|authorization|cookie/u
    )
  } finally {
    globalThis.fetch = originalFetch
    console.info = originalConsoleInfo
    if (originalTmdbKey === undefined) delete process.env.TMDB_API_KEY
    else process.env.TMDB_API_KEY = originalTmdbKey
    if (originalVectorUrl === undefined) delete process.env.UPSTASH_VECTOR_REST_URL
    else process.env.UPSTASH_VECTOR_REST_URL = originalVectorUrl
    if (originalVectorToken === undefined) delete process.env.UPSTASH_VECTOR_REST_TOKEN
    else process.env.UPSTASH_VECTOR_REST_TOKEN = originalVectorToken
  }
})
