import assert from 'node:assert/strict'
import test from 'node:test'

import { SEARCH_SCHEMA_VERSION } from '@kino/core/search'

import { SearchGatewayError } from './errors.ts'
import { parseSearchRequest, parseSearchRequestV1 } from './request.ts'

const validRequest = {
  schemaVersion: SEARCH_SCHEMA_VERSION,
  query: '  Alien   1979  ',
  locale: 'pt_br',
  region: 'br',
  mediaTypes: ['movie'],
  page: 2,
  limit: 25,
  mode: 'full',
}

test('normalizes a supported v1 request and ignores additive unknown fields', () => {
  assert.deepEqual(parseSearchRequestV1({ ...validRequest, futureOption: true }), {
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query: 'Alien 1979',
    locale: 'pt-BR',
    region: 'BR',
    mediaTypes: ['movie'],
    page: 2,
    limit: 25,
    mode: 'full',
  })
})

test('accepts requests at both result-window boundaries', () => {
  for (const paging of [
    { page: 100, limit: 1 },
    { page: 2, limit: 50 },
  ]) {
    assert.deepEqual(
      parseSearchRequestV1({
        schemaVersion: SEARCH_SCHEMA_VERSION,
        query: 'Alien',
        ...paging,
      }),
      {
        schemaVersion: SEARCH_SCHEMA_VERSION,
        query: 'Alien',
        ...paging,
        mode: 'full',
      }
    )
  }
})

test('rejects individually valid paging values whose result window exceeds 500', () => {
  for (const paging of [
    { page: 11, limit: 50 },
    { page: 100, limit: 50 },
  ]) {
    assert.throws(
      () =>
        parseSearchRequestV1({
          schemaVersion: SEARCH_SCHEMA_VERSION,
          query: 'Alien',
          ...paging,
        }),
      (error) =>
        error instanceof SearchGatewayError &&
        error.status === 400 &&
        error.body.error.code === 'invalid_request'
    )
  }
})

test('rejects unsupported schemas with the negotiated supported range', () => {
  assert.throws(
    () => parseSearchRequestV1({ ...validRequest, schemaVersion: 2 }),
    (error) =>
      error instanceof SearchGatewayError &&
      error.status === 426 &&
      assert.deepEqual(error.body, {
        error: {
          code: 'unsupported_version',
          supportedMinimum: SEARCH_SCHEMA_VERSION,
          supportedMaximum: 2,
          upgradeRequired: true,
        },
      }) === undefined
  )
})

test('defaults schema-less new requests to V2 while preserving explicit versions', () => {
  assert.equal(parseSearchRequest({ query: 'Alien' }).schemaVersion, 2)
  assert.equal(parseSearchRequest({ schemaVersion: 1, query: 'Alien' }).schemaVersion, 1)
  assert.equal(parseSearchRequest({ schemaVersion: 2, query: 'Alien' }).schemaVersion, 2)
  assert.equal(parseSearchRequest({ query: 'Alien' }).mode, 'full')
  assert.equal(
    parseSearchRequest({ schemaVersion: 2, query: 'Alien', mode: 'autocomplete' }).mode,
    'autocomplete'
  )
})

const invalidRequests = [
  {
    name: 'non-object body',
    request: null,
    field: 'body',
  },
  {
    name: 'empty query',
    request: { ...validRequest, query: ' \n\t ' },
    field: 'query',
  },
  {
    name: 'query over 200 Unicode code points',
    request: { ...validRequest, query: '😀'.repeat(201) },
    field: 'query',
  },
  {
    name: 'invalid locale',
    request: { ...validRequest, locale: 'not a locale!' },
    field: 'locale',
  },
  {
    name: 'invalid region',
    request: { ...validRequest, region: 'BRAZIL' },
    field: 'region',
  },
  {
    name: 'invalid media type',
    request: { ...validRequest, mediaTypes: ['movie', 'documentary'] },
    field: 'mediaTypes',
  },
  {
    name: 'negative page',
    request: { ...validRequest, page: -1 },
    field: 'page',
  },
  {
    name: 'page over 100',
    request: { ...validRequest, page: 101 },
    field: 'page',
  },
  {
    name: 'limit over 50',
    request: { ...validRequest, limit: 51 },
    field: 'limit',
  },
  {
    name: 'invalid mode',
    request: { ...validRequest, mode: 'fast' },
    field: 'mode',
  },
]

for (const { name, request, field } of invalidRequests) {
  test(`rejects ${name} without exposing raw input`, () => {
    assert.throws(
      () => parseSearchRequestV1(request),
      (error) =>
        error instanceof SearchGatewayError &&
        error.status === 400 &&
        assert.deepEqual(error.body, {
          error: {
            code: 'invalid_request',
            field,
            retryable: false,
          },
        }) === undefined &&
        !JSON.stringify(error.body).includes('😀')
    )
  })
}

test('creates platform-neutral rate-limit and availability responses', () => {
  assert.deepEqual(SearchGatewayError.rateLimited(9).body, {
    error: {
      code: 'rate_limited',
      retryable: true,
      retryAfterSeconds: 9,
    },
  })
  assert.deepEqual(SearchGatewayError.temporaryUnavailable().body, {
    error: {
      code: 'temporary_unavailable',
      retryable: true,
    },
  })
})
