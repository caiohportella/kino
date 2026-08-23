import assert from 'node:assert/strict'
import test from 'node:test'

import { createLocalizedTitleNameRouteHandler } from '../../localization/localized-title-name-route.ts'

test('accepts a valid title-name batch and returns localized names', async () => {
  let receivedInput

  const handler = createLocalizedTitleNameRouteHandler({
    resolve: async (input) => {
      receivedInput = input

      return {
        schemaVersion: 1,
        names: [
          {
            id: 238,
            mediaType: 'movie',
            title: 'O Poderoso Chefão',
          },
        ],
        missing: [],
        errors: [],
      }
    },
  })

  const request = new Request('http://localhost/api/v1/titles/names', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      items: [
        {
          tmdbId: 238,
          type: 'movie',
        },
      ],
      locale: 'pt-BR',
      region: 'BR',
    }),
  })

  const response = await handler(request)

  assert.equal(response.status, 200)

  assert.deepEqual(receivedInput, {
    schemaVersion: 1,
    items: [
      {
        tmdbId: 238,
        type: 'movie',
      },
    ],
    locale: 'pt-BR',
    region: 'BR',
  })

  assert.deepEqual(await response.json(), {
    schemaVersion: 1,
    names: [
      {
        id: 238,
        mediaType: 'movie',
        title: 'O Poderoso Chefão',
      },
    ],
    missing: [],
    errors: [],
  })

  assert.equal(
    response.headers.get('cache-control'),
    'private, max-age=300, stale-while-revalidate=86400'
  )
})

test('rejects malformed title-name batches', async () => {
  let called = false

  const handler = createLocalizedTitleNameRouteHandler({
    resolve: async () => {
      called = true
      throw new Error('should not run')
    },
  })

  const request = new Request('http://localhost/api/v1/titles/names', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      items: [],
      locale: 'pt-BR',
      region: 'BR',
    }),
  })

  const response = await handler(request)

  assert.equal(response.status, 400)
  assert.equal(called, false)

  assert.deepEqual(await response.json(), {
    error: 'Invalid localized title name batch.',
  })
})

test('returns 503 when title localization fails', async () => {
  const handler = createLocalizedTitleNameRouteHandler({
    resolve: async () => {
      throw new Error('TMDb unavailable')
    },
  })

  const request = new Request('http://localhost/api/v1/titles/names', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      schemaVersion: 1,
      items: [
        {
          tmdbId: 238,
          type: 'movie',
        },
      ],
      locale: 'pt-BR',
      region: 'BR',
    }),
  })

  const response = await handler(request)

  assert.equal(response.status, 503)

  assert.deepEqual(await response.json(), {
    error: 'Title localization is unavailable.',
  })
})
