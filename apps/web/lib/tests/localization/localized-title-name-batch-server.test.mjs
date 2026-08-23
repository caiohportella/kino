import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createLocalizedTitleNameBatchService,
  createTmdbLocalizedTitleNameBatchService,
} from '../../localization/localized-title-name-batch-server.ts'

const baseInput = {
  schemaVersion: 1,
  items: [{ tmdbId: 238, type: 'movie' }],
  locale: 'pt-BR',
  region: 'BR',
}

test('resolves localized title names without artwork data', async () => {
  const service = createLocalizedTitleNameBatchService({
    fetchTitleName: async (item, context) => {
      assert.deepEqual(item, {
        tmdbId: 238,
        type: 'movie',
      })

      assert.deepEqual(context, {
        locale: 'pt-BR',
        region: 'BR',
      })

      return 'O Poderoso Chefão'
    },
  })

  const response = await service.resolve(baseInput)

  assert.deepEqual(response, {
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
})

test('repeated batches reuse the locale-region cache', async () => {
  let calls = 0

  const service = createLocalizedTitleNameBatchService({
    fetchTitleName: async () => {
      calls += 1
      return 'O Poderoso Chefão'
    },
  })

  await service.resolve(baseInput)
  await service.resolve(baseInput)

  assert.equal(calls, 1)
})

test('duplicate items share one provider request', async () => {
  let calls = 0

  const service = createLocalizedTitleNameBatchService({
    fetchTitleName: async () => {
      calls += 1
      return 'O Poderoso Chefão'
    },
  })

  const response = await service.resolve({
    ...baseInput,
    items: [baseInput.items[0], baseInput.items[0]],
  })

  assert.equal(calls, 1)
  assert.equal(response.names.length, 1)
})

test('empty provider titles are reported as missing', async () => {
  const service = createLocalizedTitleNameBatchService({
    fetchTitleName: async () => '   ',
  })

  const response = await service.resolve(baseInput)

  assert.deepEqual(response.names, [])
  assert.deepEqual(response.missing, [
    {
      tmdbId: 238,
      type: 'movie',
    },
  ])
  assert.deepEqual(response.errors, [])
})

test('provider failures are preserved without failing the whole batch', async () => {
  const service = createLocalizedTitleNameBatchService({
    fetchTitleName: async (item) => {
      if (item.tmdbId === 2) {
        throw new Error('provider failed')
      }

      return `Title ${item.tmdbId}`
    },
  })

  const response = await service.resolve({
    ...baseInput,
    items: [
      { tmdbId: 1, type: 'movie' },
      { tmdbId: 2, type: 'tv' },
      { tmdbId: 3, type: 'movie' },
    ],
  })

  assert.deepEqual(
    response.names.map((name) => name.id),
    [1, 3]
  )

  assert.deepEqual(response.errors, [
    {
      tmdbId: 2,
      type: 'tv',
    },
  ])
})

test('TMDb title-name service performs details requests only and never requests images', async () => {
  const originalFetch = globalThis.fetch
  const urls = []

  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    urls.push(url)

    if (url.pathname === '/3/movie/238') {
      return new Response(
        JSON.stringify({
          id: 238,
          title: 'O Poderoso Chefão',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    }

    if (url.pathname === '/3/tv/1399') {
      return new Response(
        JSON.stringify({
          id: 1399,
          name: 'Game of Thrones',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      )
    }

    throw new Error(`Unexpected TMDb request: ${url}`)
  }

  try {
    const service = createTmdbLocalizedTitleNameBatchService('test-api-key')

    const response = await service.resolve({
      schemaVersion: 1,
      items: [
        { tmdbId: 238, type: 'movie' },
        { tmdbId: 1399, type: 'tv' },
      ],
      locale: 'pt-BR',
      region: 'BR',
    })

    assert.deepEqual(response.names, [
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
    ])

    assert.equal(urls.length, 2)

    assert.deepEqual(urls.map((url) => url.pathname).sort(), ['/3/movie/238', '/3/tv/1399'])

    assert.equal(
      urls.some((url) => url.pathname.endsWith('/images')),
      false
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('overlapping batches share in-flight provider requests', async () => {
  let calls = 0
  let releaseProvider

  const providerGate = new Promise((resolve) => {
    releaseProvider = resolve
  })

  let providerStarted
  const started = new Promise((resolve) => {
    providerStarted = resolve
  })

  const service = createLocalizedTitleNameBatchService({
    fetchTitleName: async () => {
      calls += 1
      providerStarted()
      await providerGate

      return 'O Poderoso Chefão'
    },
  })

  const first = service.resolve(baseInput)

  await started

  const second = service.resolve(baseInput)

  // The second batch should join the request already in progress,
  // rather than starting another TMDb call.
  assert.equal(calls, 1)

  releaseProvider()

  const [firstResponse, secondResponse] = await Promise.all([first, second])

  assert.equal(calls, 1)

  assert.deepEqual(firstResponse.names, secondResponse.names)

  assert.equal(firstResponse.names[0].title, 'O Poderoso Chefão')
})

test('name batches process eight provider requests concurrently by default', async () => {
  let active = 0
  let maximum = 0

  const service = createLocalizedTitleNameBatchService({
    fetchTitleName: async (item) => {
      active += 1
      maximum = Math.max(maximum, active)

      await new Promise((resolve) => setTimeout(resolve, 20))

      active -= 1

      return `Title ${item.tmdbId}`
    },
  })

  await service.resolve({
    ...baseInput,
    items: Array.from({ length: 8 }, (_, index) => ({
      tmdbId: index + 1,
      type: index % 2 === 0 ? 'movie' : 'tv',
    })),
  })

  assert.equal(maximum, 8)
})
