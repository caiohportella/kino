import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSearchGatewayEvent,
  fingerprintSearchQuery,
  publishSearchGatewayEvent,
} from './observability.ts'

test('fingerprints normalized queries without retaining raw text', async () => {
  const first = await fingerprintSearchQuery('  MÁRLON   Brando ')
  const second = await fingerprintSearchQuery('marlon brando')
  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{24}$/u)
  assert.equal(first.includes('marlon'), false)
})

test('builds a strict-whitelist event that excludes secrets, raw query, and headers', () => {
  const event = createSearchGatewayEvent({
    traceId: 'trace-1',
    schemaVersion: 1,
    queryFingerprint: 'a'.repeat(24),
    outcome: 'success',
    fallback: 'provider_unavailable',
    resultCount: 2,
    durationMs: 18.7,
    cancelled: false,
    providerFailure: false,
    rateLimited: false,
    query: 'Marlon Brando',
    token: 'server-secret',
    headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
  })

  assert.deepEqual(event, {
    type: 'search_gateway_request',
    traceId: 'trace-1',
    schemaVersion: 1,
    queryFingerprint: 'a'.repeat(24),
    outcome: 'success',
    fallback: 'provider_unavailable',
    resultCount: 2,
    durationMs: 19,
    cancelled: false,
    providerFailure: false,
    rateLimited: false,
  })
  assert.doesNotMatch(JSON.stringify(event), /Marlon|secret|authorization|cookie/u)
})

test('isolates synchronous and asynchronous telemetry sink failures', async () => {
  const event = createSearchGatewayEvent({
    traceId: 'trace-1',
    outcome: 'failure',
    durationMs: 1,
    cancelled: false,
    providerFailure: true,
    rateLimited: false,
  })
  assert.doesNotThrow(() =>
    publishSearchGatewayEvent(
      {
        emit() {
          throw new Error('metrics unavailable')
        },
      },
      event
    )
  )
  publishSearchGatewayEvent(
    {
      emit: async () => Promise.reject(new Error('metrics unavailable')),
    },
    event
  )
  await new Promise((resolve) => setImmediate(resolve))
})
