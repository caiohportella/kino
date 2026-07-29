import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { QueryClient } from '@tanstack/query-core'
import { titleQueryKeys } from '../../../packages/core/src/cache/query-keys.ts'
import { hydrateLocalizedTitleBatch } from './localized-title-batch.ts'

test('cold web multi-title hydration uses one batch request and seeds every canonical summary', async () => {
  const queryClient = new QueryClient()
  let requests = 0
  const input = {
    items: [
      { tmdbId: 238, type: 'movie' },
      { tmdbId: 1396, type: 'tv' },
    ],
    locale: 'pt',
    region: 'BR',
  }

  const result = await hydrateLocalizedTitleBatch(queryClient, input, async () => {
    requests += 1
    return {
      errors: [],
      missing: [],
      summaries: [
        summary(238, 'movie', 'O Poderoso Chefão', '/godfather-pt.jpg'),
        summary(1396, 'tv', 'Breaking Bad', '/breaking-bad-pt.jpg'),
      ],
    }
  })

  assert.equal(requests, 1)
  assert.equal(result.summaries.length, 2)
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
    assert.equal(cached.posterResolution.source, 'tmdb-localized-details')
  }
  queryClient.clear()
})

test('localized summary gateway uses only server TMDB credentials and declares poster resolution', async () => {
  const source = await readFile(
    new URL('../app/api/v1/titles/summaries/route.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /process\.env\.TMDB_API_KEY/)
  assert.doesNotMatch(source, /NEXT_PUBLIC|EXPO_PUBLIC/)
  assert.match(source, /source:\s*'tmdb-localized-details'/)
  assert.match(source, /MAX_BATCH_ITEMS/)
})

function summary(id, mediaType, title, posterPath) {
  return {
    backdropPath: null,
    id,
    mediaType,
    posterPath,
    posterResolution: {
      locale: 'pt',
      source: 'tmdb-localized-details',
    },
    title,
    year: null,
  }
}
