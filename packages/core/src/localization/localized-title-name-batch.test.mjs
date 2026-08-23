import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
  normalizeLocalizedTitleNameBatchRequest,
  normalizeLocalizedTitleNameBatchResponse,
} from './localized-title-name-batch.ts'

const request = {
  schemaVersion: 1,
  items: [
    { tmdbId: 238, type: 'movie' },
    { tmdbId: 1399, type: 'tv' },
  ],
  locale: 'pt-BR',
  region: 'BR',
}

test('normalizes a versioned localized-title-name batch request', () => {
  assert.equal(LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION, 1)

  assert.deepEqual(normalizeLocalizedTitleNameBatchRequest(request), request)

  assert.throws(() =>
    normalizeLocalizedTitleNameBatchRequest({
      ...request,
      schemaVersion: 2,
    })
  )

  assert.throws(() =>
    normalizeLocalizedTitleNameBatchRequest({
      ...request,
      items: Array.from({ length: 101 }, (_, index) => ({
        tmdbId: index + 1,
        type: 'movie',
      })),
    })
  )
})

test('normalizes localized title names', () => {
  const response = {
    schemaVersion: 1,
    names: [
      {
        id: 238,
        mediaType: 'movie',
        title: 'O Poderoso Chefão',
      },
      {
        id: 1399,
        mediaType: 'tv',
        title: 'Game of Thrones',
      },
    ],
    missing: [],
    errors: [],
  }

  assert.deepEqual(normalizeLocalizedTitleNameBatchResponse(response), response)

  assert.throws(() =>
    normalizeLocalizedTitleNameBatchResponse({
      ...response,
      names: [
        {
          id: 238,
          mediaType: 'movie',
          title: '',
        },
      ],
    })
  )
})
