import assert from 'node:assert/strict'
import test from 'node:test'
import { SEARCH_SCHEMA_VERSION } from '@kino/core/search'
import { createSearchGatewayClient, SearchGatewayClientError } from './client.ts'

test('web gateway uses same-origin v1 contract with cancellation and pagination', async () => {
  let request
  const client = createSearchGatewayClient({
    fetch: async (url, init) => {
      request = { url, init }
      return Response.json({
        schemaVersion: SEARCH_SCHEMA_VERSION,
        query: { folded: 'brando', original: 'Brando', tokens: ['brando'] },
        results: [],
        groups: [],
        total: 0,
        page: 2,
        limit: 12,
      })
    },
  })
  const result = await client.search({
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query: 'Brando',
    page: 2,
    limit: 12,
  })
  assert.equal(request.url, '/api/v1/search')
  assert.equal(JSON.parse(request.init.body).page, 2)
  assert.equal(result.page, 2)
})

test('web gateway turns platform-neutral error bodies and invalid schemas into typed errors', async () => {
  const unavailable = createSearchGatewayClient({
    fetch: async () =>
      Response.json({ error: { code: 'temporary_unavailable', retryable: true } }, { status: 503 }),
  })
  await assert.rejects(
    unavailable.search({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'x' }),
    (error) => error instanceof SearchGatewayClientError && error.code === 'temporary_unavailable'
  )
})

test('web gateway normalizes rejected fetches and non-json HTTP failures', async () => {
  const request = { schemaVersion: SEARCH_SCHEMA_VERSION, query: 'x' }
  await assert.rejects(
    createSearchGatewayClient({
      fetch: async () => Promise.reject(new TypeError('offline')),
    }).search(request),
    (error) => error instanceof SearchGatewayClientError && error.code === 'network_error'
  )
  await assert.rejects(
    createSearchGatewayClient({
      fetch: async () => new Response('bad gateway', { status: 502 }),
    }).search(request),
    (error) =>
      error instanceof SearchGatewayClientError &&
      error.code === 'http_error' &&
      error.status === 502
  )
})
