import assert from 'node:assert/strict'
import test from 'node:test'
import { SEARCH_SCHEMA_VERSION, SEARCH_SCHEMA_VERSION_V2 } from '@kino/core/search'
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

test('mobile gateway accepts V2 while preserving explicit V1 rollback compatibility', async () => {
  const versions = []
  const gateway = createSearchGateway({
    origin: 'https://kino.example.com',
    fetch: async (_url, init) => {
      const version = JSON.parse(init.body).schemaVersion
      versions.push(version)
      return Response.json({ ...response, schemaVersion: version })
    },
  })
  assert.equal(
    (await gateway.search({ schemaVersion: SEARCH_SCHEMA_VERSION_V2, query: 'Brando' }))
      .schemaVersion,
    2
  )
  assert.equal(
    (await gateway.search({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Brando' })).schemaVersion,
    1
  )
  assert.deepEqual(versions, [2, 1])
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

test('mobile gateway normalizes rejected fetches and non-json HTTP failures', async () => {
  const request = { schemaVersion: SEARCH_SCHEMA_VERSION, query: 'x' }
  await assert.rejects(
    createSearchGateway({
      origin: 'https://kino.example.com',
      fetch: async () => Promise.reject(new TypeError('offline')),
    }).search(request),
    (error) => error instanceof SearchGatewayClientError && error.code === 'network_error'
  )
  await assert.rejects(
    createSearchGateway({
      origin: 'https://kino.example.com',
      fetch: async () => new Response('bad gateway', { status: 502 }),
    }).search(request),
    (error) =>
      error instanceof SearchGatewayClientError &&
      error.code === 'http_error' &&
      error.status === 502
  )
})
