import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { titleQueryKeys } from '@kino/core/cache'
import { QueryClient } from '@tanstack/react-query'
import { hydrateLocalizedTitleBatch } from '../../localization/localized-title-batch.ts'

test('cold web multi-title hydration uses one batch request and seeds every canonical summary', async () => {
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

  const result = await hydrateLocalizedTitleBatch(queryClient, input, async () => {
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
    assert.equal(cached.posterResolution.source, 'tmdb-images')
  }
  queryClient.clear()
})

test('web batch hydration reuses fresh canonical summaries and requests only cache misses', async () => {
  const queryClient = new QueryClient()

  const input = {
    schemaVersion: 1,
    items: [
      { tmdbId: 238, type: 'movie' },
      { tmdbId: 1396, type: 'tv' },
    ],
    locale: 'pt',
    region: 'BR',
  }

  const cachedSummary = summary(238, 'movie', 'O Poderoso Chefão', '/godfather-cached.jpg')

  queryClient.setQueryData(
    titleQueryKeys.summary({
      id: 238,
      locale: input.locale,
      mediaType: 'movie',
      region: input.region,
      scope: { kind: 'public' },
    }),
    cachedSummary
  )

  const requestedItems = []

  const result = await hydrateLocalizedTitleBatch(queryClient, input, async (chunk) => {
    requestedItems.push(...chunk.items)

    return {
      schemaVersion: 1,
      errors: [],
      missing: [],
      summaries: chunk.items.map((item) =>
        summary(
          item.tmdbId,
          item.type,
          item.tmdbId === 1396 ? 'Breaking Bad' : 'should not be fetched',
          `/${item.tmdbId}.jpg`
        )
      ),
    }
  })

  assert.deepEqual(requestedItems, [{ tmdbId: 1396, type: 'tv' }])

  assert.deepEqual(
    result.summaries.map((item) => item.id),
    [238, 1396]
  )

  assert.equal(
    result.summaries.find((item) => item.id === 238)?.posterPath,
    '/godfather-cached.jpg'
  )

  queryClient.clear()
})

test('localized summary gateway uses only server TMDB credentials and declares poster resolution', async () => {
  const source = await readFile(
    new URL('../../../app/api/v1/titles/summaries/route.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /process\.env\.TMDB_API_KEY/)
  assert.doesNotMatch(source, /NEXT_PUBLIC|EXPO_PUBLIC/)
  assert.match(source, /normalizeLocalizedTitleBatchRequest/)
  assert.match(source, /createTmdbLocalizedTitleBatchService/)
})

for (const [count, expectedSizes] of [
  [100, [100]],
  [101, [100, 1]],
]) {
  test(`web batch adapter chunks ${count} titles without oversized or per-card calls`, async () => {
    const queryClient = new QueryClient()
    const sizes = []
    const input = batchInput(count)
    const response = await hydrateLocalizedTitleBatch(queryClient, input, async (chunk) => {
      sizes.push(chunk.items.length)
      return batchResponse(chunk.items)
    })
    assert.deepEqual(sizes, expectedSizes)
    assert.deepEqual(
      response.summaries.map((item) => item.id),
      input.items.map((item) => item.tmdbId)
    )
    queryClient.clear()
  })
}

test('web batch adapter merges 250 titles stably and preserves a failed chunk as item errors', async () => {
  const queryClient = new QueryClient()
  const input = batchInput(250)
  let calls = 0
  const response = await hydrateLocalizedTitleBatch(queryClient, input, async (chunk) => {
    calls += 1
    if (calls === 2) throw new Error('chunk unavailable')
    return batchResponse(chunk.items)
  })
  assert.equal(calls, 3)
  assert.deepEqual(
    response.summaries.map((item) => item.id),
    [...input.items.slice(0, 100), ...input.items.slice(200)].map((item) => item.tmdbId)
  )
  assert.deepEqual(response.errors, input.items.slice(100, 200))
  for (const item of [...input.items.slice(0, 100), ...input.items.slice(200)]) {
    assert.ok(
      queryClient.getQueryData(
        titleQueryKeys.summary({
          id: item.tmdbId,
          locale: input.locale,
          mediaType: item.type,
          region: input.region,
          scope: { kind: 'public' },
        })
      )
    )
  }
  queryClient.clear()
})

function summary(id, mediaType, title, posterPath) {
  return {
    backdropPath: null,
    backdropResolution: {
      fallbackReason: 'kino-placeholder',
      languageTier: 'placeholder',
      locale: 'pt',
      source: 'tmdb-images',
    },
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

function batchInput(count) {
  return {
    schemaVersion: 1,
    items: Array.from({ length: count }, (_, index) => ({
      tmdbId: index + 1,
      type: index % 2 ? 'tv' : 'movie',
    })),
    locale: 'pt',
    region: 'BR',
  }
}

function batchResponse(items) {
  return {
    schemaVersion: 1,
    errors: [],
    missing: [],
    summaries: items.map((item) =>
      summary(item.tmdbId, item.type, `Title ${item.tmdbId}`, `/poster-${item.tmdbId}.jpg`)
    ),
  }
}
