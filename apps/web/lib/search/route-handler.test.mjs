import assert from 'node:assert/strict'
import test from 'node:test'

import { SEARCH_SCHEMA_VERSION } from '@kino/core/search'

import { createSearchRouteHandler } from './route-handler.ts'

const success = {
  schemaVersion: SEARCH_SCHEMA_VERSION,
  query: { original: 'Alien', folded: 'alien', tokens: ['alien'] },
  results: [],
  groups: [],
  total: 0,
  page: 1,
  limit: 20,
  fallback: 'provider_unavailable',
}

test('parses POST JSON, supplies the request signal, and returns the shared response', async () => {
  let received
  const handler = createSearchRouteHandler({
    gateway: {
      search: async (request, signal) => {
        received = { request, signal }
        return success
      },
    },
  })
  const request = new Request('https://kino.example/api/v1/search', {
    method: 'POST',
    body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
  })

  const response = await handler(request)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), success)
  assert.deepEqual(received.request, {
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query: 'Alien',
  })
  assert.equal(received.signal, request.signal)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('serializes invalid JSON and unsupported versions as typed errors', async () => {
  const handler = createSearchRouteHandler({
    gateway: { search: async () => success },
  })
  const cases = [
    {
      body: '{not-json',
      status: 400,
      code: 'invalid_request',
    },
    {
      body: JSON.stringify({ schemaVersion: 99, query: 'Alien' }),
      status: 426,
      code: 'unsupported_version',
    },
  ]

  for (const entry of cases) {
    const response = await handler(
      new Request('https://kino.example/api/v1/search', {
        method: 'POST',
        body: entry.body,
      })
    )
    assert.equal(response.status, entry.status)
    assert.equal((await response.json()).error.code, entry.code)
  }
})

test('sanitizes unexpected gateway failures and propagates caller cancellation', async () => {
  const failureHandler = createSearchRouteHandler({
    gateway: { search: async () => Promise.reject(new Error('provider token leaked')) },
  })
  const request = new Request('https://kino.example/api/v1/search', {
    method: 'POST',
    body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
  })
  const failure = await failureHandler(request)
  assert.equal(failure.status, 503)
  assert.deepEqual(await failure.json(), {
    error: { code: 'temporary_unavailable', retryable: true },
  })

  const reason = new DOMException('caller cancelled', 'AbortError')
  const cancellationHandler = createSearchRouteHandler({
    gateway: { search: async () => Promise.reject(reason) },
  })
  await assert.rejects(
    cancellationHandler(
      new Request('https://kino.example/api/v1/search', {
        method: 'POST',
        body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
      })
    ),
    (error) => error === reason
  )
})
