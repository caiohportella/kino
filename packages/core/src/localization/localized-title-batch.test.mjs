import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
  normalizeLocalizedTitleBatchRequest,
  normalizeLocalizedTitleBatchResponse,
  toLocalizedTitleSummaryCacheEntry,
} from './localized-title-batch.ts'

const request = {
  schemaVersion: 1,
  items: [
    { tmdbId: 238, type: 'movie' },
    { tmdbId: 1399, type: 'tv' },
  ],
  locale: 'pt-BR',
  region: 'BR',
}

test('normalizes a versioned localized-title batch request', () => {
  assert.equal(LOCALIZED_TITLE_BATCH_SCHEMA_VERSION, 1)
  assert.deepEqual(normalizeLocalizedTitleBatchRequest(request), request)
  assert.throws(() => normalizeLocalizedTitleBatchRequest({ ...request, schemaVersion: 2 }))
  assert.throws(() =>
    normalizeLocalizedTitleBatchRequest({
      ...request,
      items: Array.from({ length: 101 }, (_, index) => ({ tmdbId: index + 1, type: 'movie' })),
    })
  )
})

test('validates a localized poster resolution response at runtime', () => {
  const response = {
    schemaVersion: 1,
    summaries: [
      {
        backdropPath: '/backdrop.jpg',
        backdropResolution: {
          fallbackReason: 'language-neutral',
          languageTier: 'neutral',
          locale: 'pt-BR',
          source: 'tmdb-images',
        },
        id: 238,
        mediaType: 'movie',
        posterPath: '/poster.jpg',
        posterResolution: {
          fallbackReason: null,
          languageTier: 'exact',
          locale: 'pt-BR',
          source: 'tmdb-images',
        },
        title: 'O Poderoso Chefão',
        year: 1972,
      },
    ],
    missing: [],
    errors: [],
  }

  assert.deepEqual(normalizeLocalizedTitleBatchResponse(response), response)
  assert.throws(() =>
    normalizeLocalizedTitleBatchResponse({
      ...response,
      summaries: [{ ...response.summaries[0], posterResolution: { source: 'claimed' } }],
    })
  )
})

test('maps a validated summary to the canonical public cache identity', () => {
  const summary = normalizeLocalizedTitleBatchResponse({
    schemaVersion: 1,
    summaries: [
      {
        backdropPath: null,
        backdropResolution: {
          fallbackReason: 'kino-placeholder',
          languageTier: 'placeholder',
          locale: 'pt-BR',
          source: 'tmdb-images',
        },
        id: 238,
        mediaType: 'movie',
        posterPath: null,
        posterResolution: {
          fallbackReason: 'kino-placeholder',
          languageTier: 'placeholder',
          locale: 'pt-BR',
          source: 'tmdb-images',
        },
        title: 'O Poderoso Chefão',
        year: 1972,
      },
    ],
    missing: [],
    errors: [],
  }).summaries[0]

  assert.deepEqual(toLocalizedTitleSummaryCacheEntry(summary, request), {
    input: {
      id: 238,
      locale: 'pt-BR',
      mediaType: 'movie',
      region: 'BR',
      scope: { kind: 'public' },
    },
    summary,
  })
})
