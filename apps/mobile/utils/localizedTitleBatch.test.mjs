import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient } from '@tanstack/query-core'
import { titleQueryKeys } from '../../../packages/core/src/cache/query-keys.ts'
import { hydrateLocalizedTitleBatch } from '../hooks/data/localizedTitleBatch.ts'

test('cold mobile multi-title hydration uses one gateway request and seeds localized summaries', async () => {
  const queryClient = new QueryClient()
  let requests = 0
  const input = {
    schemaVersion: 1,
    items: [
      { tmdbId: 238, type: 'movie' },
      { tmdbId: 1396, type: 'tv' },
    ],
    locale: 'pt',
    region: 'BR',
  }

  await hydrateLocalizedTitleBatch(queryClient, input, async () => {
    requests += 1
    return {
      schemaVersion: 1,
      errors: [],
      missing: [],
      summaries: [
        summary(238, 'movie', 'O Poderoso Chefão', '/godfather-pt.jpg'),
        summary(1396, 'tv', 'Breaking Bad', '/breaking-bad-pt.jpg'),
      ],
    }
  })

  assert.equal(requests, 1)
  for (const item of input.items) {
    const cached = queryClient.getQueryData(
      titleQueryKeys.summary({
        id: item.tmdbId,
        locale: input.locale,
        mediaType: item.type,
        region: input.region,
        scope: { kind: 'public' },
      })
    )
    assert.equal(cached.posterResolution.source, 'tmdb-images')
  }
  queryClient.clear()
})

function summary(id, mediaType, title, posterPath) {
  return {
    backdropPath: null,
    id,
    mediaType,
    posterPath,
    posterResolution: {
      fallbackReason: null,
      languageTier: 'exact',
      locale: 'pt',
      source: 'tmdb-images',
    },
    title,
    year: null,
  }
}
