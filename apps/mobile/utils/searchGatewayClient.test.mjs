import assert from 'node:assert/strict'
import test from 'node:test'
import { SEARCH_SCHEMA_VERSION } from '@kino/core/search'
import { createSearchGateway, SearchGatewayClientError } from '../services/search-gateway.ts'

const response = {
  schemaVersion: SEARCH_SCHEMA_VERSION,
  query: { folded: 'brando', original: 'Brando', tokens: ['brando'] },
  results: [],
  groups: [],
  total: 0,
  page: 1,
  limit: 8,
  fallback: 'provider_unavailable',
}

test('mobile gateway posts the shared schema and preserves gateway fallback', async () => {
  const calls = []
  const gateway = createSearchGateway({
    origin: 'https://kino.example.com',
    fetch: async (url, init) => {
      calls.push({ url, init })
      return Response.json(response)
    },
  })
  assert.deepEqual(
    await gateway.search({
      schemaVersion: SEARCH_SCHEMA_VERSION,
      query: 'Brando',
      page: 1,
      limit: 8,
    }),
    response
  )
  assert.equal(calls[0].url, 'https://kino.example.com/api/v1/search')
  assert.equal(JSON.parse(calls[0].init.body).schemaVersion, SEARCH_SCHEMA_VERSION)
})

test('mobile gateway propagates cancellation and returns typed timeout/schema errors', async () => {
  const controller = new AbortController()
  controller.abort()
  const cancelled = createSearchGateway({ origin: 'https://kino.example.com', fetch })
  await assert.rejects(
    cancelled.search({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'x' }, controller.signal),
    (error) => error.name === 'AbortError'
  )

  const malformed = createSearchGateway({
    origin: 'https://kino.example.com',
    fetch: async () => Response.json({ schemaVersion: 999 }),
  })
  await assert.rejects(
    malformed.search({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'x' }),
    (error) => error instanceof SearchGatewayClientError && error.code === 'invalid_response'
  )

  const timeout = createSearchGateway({
    origin: 'https://kino.example.com',
    timeoutMs: 1,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error(), { name: 'AbortError' }))
        )
      }),
  })
  await assert.rejects(
    timeout.search({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'x' }),
    (error) => error instanceof SearchGatewayClientError && error.code === 'timeout'
  )
})
