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

test('rejects rate-limited requests before invoking the gateway', async () => {
  let gatewayCalls = 0
  const events = []
  const handler = createSearchRouteHandler({
    gateway: {
      search: async () => {
        gatewayCalls += 1
        return success
      },
    },
    rateLimiter: {
      check: async () => ({ allowed: false, remaining: 0, retryAfterSeconds: 7 }),
    },
    clientKey: () => 'trusted-client-key',
    traceId: () => 'trace-rate-limit',
    eventSink: { emit: (event) => events.push(event) },
    now: () => 100,
  })

  const response = await handler(
    new Request('https://kino.example/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
    })
  )
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '7')
  assert.equal(response.headers.get('x-request-id'), 'trace-rate-limit')
  assert.equal(gatewayCalls, 0)
  assert.equal(events.length, 1)
  assert.equal(events[0].rateLimited, true)
  assert.equal(events[0].providerFailure, false)
})

test('records sanitized fallback telemetry with a trace id and fingerprint', async () => {
  const events = []
  let now = 1_000
  const handler = createSearchRouteHandler({
    gateway: { search: async () => success },
    traceId: () => 'trace-success',
    eventSink: { emit: (event) => events.push(event) },
    now: () => {
      const value = now
      now += 12
      return value
    },
  })

  const response = await handler(
    new Request('https://kino.example/api/v1/search', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret',
        cookie: 'session=secret',
      },
      body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
    })
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-request-id'), 'trace-success')
  assert.equal(events.length, 1)
  assert.equal(events[0].fallback, 'provider_unavailable')
  assert.equal(events[0].outcome, 'success')
  assert.equal(events[0].providerFailure, true)
  assert.equal(events[0].queryFingerprint.length, 24)
  assert.doesNotMatch(JSON.stringify(events[0]), /Alien|secret|authorization|cookie/u)
})

test('records cancellation without counting it as provider failure', async () => {
  const events = []
  const reason = new DOMException('caller cancelled', 'AbortError')
  const handler = createSearchRouteHandler({
    gateway: { search: async () => Promise.reject(reason) },
    traceId: () => 'trace-cancelled',
    eventSink: { emit: (event) => events.push(event) },
  })

  await assert.rejects(
    handler(
      new Request('https://kino.example/api/v1/search', {
        method: 'POST',
        body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
      })
    ),
    (error) => error === reason
  )
  assert.equal(events.length, 1)
  assert.equal(events[0].outcome, 'cancelled')
  assert.equal(events[0].cancelled, true)
  assert.equal(events[0].providerFailure, false)
})

test('returns the search response when the observability sink throws', async () => {
  const handler = createSearchRouteHandler({
    gateway: { search: async () => success },
    eventSink: {
      emit() {
        throw new Error('metrics unavailable')
      },
    },
  })
  const response = await handler(
    new Request('https://kino.example/api/v1/search', {
      method: 'POST',
      body: JSON.stringify({ schemaVersion: SEARCH_SCHEMA_VERSION, query: 'Alien' }),
    })
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), success)
})

test('defaults schema-less requests to V2 and preserves explicit V1', async () => {
  const received = []
  const handler = createSearchRouteHandler({
    gateway: {
      search: async (request) => {
        received.push(request.schemaVersion)
        return { ...success, schemaVersion: request.schemaVersion }
      },
    },
  })
  for (const body of [{ query: 'Alien' }, { schemaVersion: 1, query: 'Alien' }]) {
    const response = await handler(
      new Request('https://kino.example/api/v1/search', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )
    assert.equal(response.status, 200)
  }
  assert.deepEqual(received, [2, 1])
})
