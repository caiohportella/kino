import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLocalizedTitleBatchService,
  createLocalizedTitleRateLimiter,
} from './localized-title-batch-server.ts'

const baseInput = {
  schemaVersion: 1,
  items: [{ tmdbId: 238, type: 'movie' }],
  locale: 'pt-BR',
  region: 'BR',
}

for (const [label, posters, expectedTier, expectedPath] of [
  [
    'exact',
    [{ file_path: '/exact.jpg', iso_639_1: 'pt', iso_3166_1: 'BR' }],
    'exact',
    '/exact.jpg',
  ],
  [
    'ambiguous-base',
    [{ file_path: '/base.jpg', iso_639_1: 'pt', iso_3166_1: 'PT' }],
    'base',
    '/base.jpg',
  ],
  ['original', [{ file_path: '/original.jpg', iso_639_1: 'it' }], 'original', '/original.jpg'],
  ['neutral', [{ file_path: '/neutral.jpg', iso_639_1: null }], 'neutral', '/neutral.jpg'],
  ['default', [], 'tmdb-default', '/default.jpg'],
  ['missing', [], 'placeholder', null],
]) {
  test(`server resolves ${label} localized poster provenance truthfully`, async () => {
    const service = createLocalizedTitleBatchService({
      fetchTitle: async () => ({
        backdrops: [],
        backdropPath: null,
        defaultBackdropPath: null,
        defaultPosterPath: label === 'missing' ? null : '/default.jpg',
        originalLanguage: 'it',
        posters,
        title: 'Localized title',
        year: 1972,
      }),
    })
    const response = await service.resolve(baseInput)
    assert.equal(response.summaries[0].posterPath, expectedPath)
    assert.equal(response.summaries[0].posterResolution.languageTier, expectedTier)
    assert.equal(response.summaries[0].posterResolution.source, 'tmdb-images')
  })
}

for (const [label, backdrops, expectedTier, expectedPath] of [
  [
    'exact',
    [{ file_path: '/exact-backdrop.jpg', iso_639_1: 'pt', iso_3166_1: 'BR' }],
    'exact',
    '/exact-backdrop.jpg',
  ],
  [
    'ambiguous-base',
    [{ file_path: '/base-backdrop.jpg', iso_639_1: 'pt', iso_3166_1: 'PT' }],
    'base',
    '/base-backdrop.jpg',
  ],
  [
    'original',
    [{ file_path: '/original-backdrop.jpg', iso_639_1: 'it' }],
    'original',
    '/original-backdrop.jpg',
  ],
  [
    'neutral',
    [{ file_path: '/neutral-backdrop.jpg', iso_639_1: null }],
    'neutral',
    '/neutral-backdrop.jpg',
  ],
  ['default', [], 'tmdb-default', '/default-backdrop.jpg'],
]) {
  test(`server resolves ${label} localized backdrop provenance truthfully`, async () => {
    const service = createLocalizedTitleBatchService({
      fetchTitle: async () => ({
        ...title(),
        backdrops,
        defaultBackdropPath: '/default-backdrop.jpg',
        originalLanguage: 'it',
      }),
    })
    const response = await service.resolve(baseInput)
    assert.equal(response.summaries[0].backdropPath, expectedPath)
    assert.equal(response.summaries[0].backdropResolution.languageTier, expectedTier)
    assert.equal(response.summaries[0].backdropResolution.source, 'tmdb-images')
  })
}

test('repeated batches reuse the locale-region server cache without provider calls', async () => {
  let calls = 0
  const service = createLocalizedTitleBatchService({
    fetchTitle: async () => {
      calls += 1
      return title()
    },
  })
  await service.resolve(baseInput)
  await service.resolve(baseInput)
  assert.equal(calls, 1)
})

test('duplicate items in one batch share one provider request', async () => {
  let calls = 0
  const service = createLocalizedTitleBatchService({
    fetchTitle: async () => {
      calls += 1
      return title()
    },
  })
  const response = await service.resolve({
    ...baseInput,
    items: [baseInput.items[0], baseInput.items[0]],
  })
  assert.equal(calls, 1)
  assert.equal(response.summaries.length, 1)
})

test('server bounds provider concurrency and preserves partial failures for batches over 40', async () => {
  let active = 0
  let maximum = 0
  const service = createLocalizedTitleBatchService({
    concurrency: 6,
    fetchTitle: async (item) => {
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active -= 1
      if (item.tmdbId === 25) throw new Error('provider failed')
      return title()
    },
  })
  const response = await service.resolve({
    ...baseInput,
    items: Array.from({ length: 50 }, (_, index) => ({
      tmdbId: index + 1,
      type: index % 2 ? 'tv' : 'movie',
    })),
  })
  assert.ok(maximum <= 6)
  assert.equal(response.summaries.length, 49)
  assert.deepEqual(response.errors, [{ tmdbId: 25, type: 'movie' }])
})

test('rate limiter rejects repeated batches after the bounded allowance', () => {
  const limiter = createLocalizedTitleRateLimiter({ limit: 2, windowMs: 60_000 })
  assert.equal(limiter.check('client-a', 0), true)
  assert.equal(limiter.check('client-a', 1), true)
  assert.equal(limiter.check('client-a', 2), false)
  assert.equal(limiter.check('client-b', 2), true)
})

function title() {
  return {
    backdrops: [],
    backdropPath: null,
    defaultBackdropPath: null,
    defaultPosterPath: '/default.jpg',
    originalLanguage: 'en',
    posters: [{ file_path: '/exact.jpg', iso_639_1: 'pt-BR' }],
    title: 'Localized title',
    year: 1972,
  }
}
