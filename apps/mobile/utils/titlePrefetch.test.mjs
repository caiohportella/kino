import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient } from '@tanstack/query-core'
import {
  LOCALIZED_TITLE_GC_TIME,
  LOCALIZED_TITLE_STALE_TIME,
} from '../../../packages/core/src/cache/policies.ts'
import {
  seedTitleSummary,
  titleDetailsQueryOptions,
  titleSummaryQueryOptions,
} from '../hooks/data/titleQueries.ts'
import { prefetchTitleDetailsOnNavigation, prefetchTitleSummary } from './titlePrefetch.ts'

const context = {
  id: 1396,
  locale: 'pt-BR',
  mediaType: 'tv',
  region: 'BR',
  scope: { kind: 'public' },
}

const summary = {
  backdropPath: '/backdrop-pt.jpg',
  id: 1396,
  mediaType: 'tv',
  posterPath: '/poster-pt.jpg',
  title: 'Breaking Bad',
  year: 2008,
}

test('mobile detail placeholder uses only a compatible locale-region-scope summary', () => {
  const queryClient = new QueryClient()
  seedTitleSummary(queryClient, context, summary)

  const compatible = titleDetailsQueryOptions(queryClient, {
    ...context,
    fetchDetails: async () => ({ ...summary, overview: 'details' }),
  })
  const wrongRegion = titleDetailsQueryOptions(queryClient, {
    ...context,
    fetchDetails: async () => ({ ...summary, overview: 'details' }),
    region: 'US',
  })

  assert.deepEqual(compatible.placeholderData(), summary)
  assert.equal(wrongRegion.placeholderData(), undefined)
  assert.notDeepEqual(compatible.queryKey, wrongRegion.queryKey)
  queryClient.clear()
})

test('mobile summary options use the named localized cache policy', () => {
  const options = titleSummaryQueryOptions({
    ...context,
    fetchSummary: async () => summary,
  })

  assert.equal(options.staleTime, LOCALIZED_TITLE_STALE_TIME)
  assert.equal(options.gcTime, LOCALIZED_TITLE_GC_TIME)
})

test('concurrent identical mobile summary prefetches invoke the fetcher once', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let fetches = 0
  const input = {
    ...context,
    fetchSummary: async () => {
      fetches += 1
      await Promise.resolve()
      return summary
    },
  }

  await Promise.all([
    prefetchTitleSummary(queryClient, input),
    prefetchTitleSummary(queryClient, input),
    prefetchTitleSummary(queryClient, input),
  ])

  assert.equal(fetches, 1)
  queryClient.clear()
})

test('seeded mobile card intents reuse the localized summary without refetching', async () => {
  const queryClient = new QueryClient()
  let fetches = 0
  seedTitleSummary(queryClient, context, summary)
  const input = {
    ...context,
    fetchSummary: async () => {
      fetches += 1
      return summary
    },
  }

  await Promise.all([
    prefetchTitleSummary(queryClient, input),
    prefetchTitleSummary(queryClient, input),
  ])

  assert.equal(fetches, 0)
  assert.deepEqual(
    titleDetailsQueryOptions(queryClient, {
      ...context,
      fetchDetails: async () => ({ ...summary, overview: 'details' }),
    }).placeholderData(),
    summary
  )
  queryClient.clear()
})

test('mobile seeded detail navigation shows the summary and fetches missing details once', async () => {
  const queryClient = new QueryClient()
  let fetches = 0
  seedTitleSummary(queryClient, context, summary)
  const options = titleDetailsQueryOptions(queryClient, {
    ...context,
    fetchDetails: async () => {
      fetches += 1
      return { ...summary, kinoId: 'kino-title', overview: 'details' }
    },
  })

  assert.deepEqual(options.placeholderData(), summary)
  await Promise.all([queryClient.fetchQuery(options), queryClient.fetchQuery(options)])
  assert.equal(fetches, 1)
  queryClient.clear()
})

test('mobile equivalent cache inputs deduplicate with the canonical fetch request', async () => {
  const queryClient = new QueryClient()
  let fetches = 0
  let fetchedRequest
  const fetchSummary = async (request) => {
    fetches += 1
    fetchedRequest = request
    await Promise.resolve()
    return summary
  }

  try {
    await Promise.all([
      prefetchTitleSummary(queryClient, {
        ...context,
        fetchSummary,
        locale: 'PT_br',
        region: 'br',
        scope: { kind: 'authenticated', userId: ' viewer-a ' },
      }),
      prefetchTitleSummary(queryClient, {
        ...context,
        fetchSummary,
        locale: 'pt-BR',
        region: 'BR',
        scope: { kind: 'authenticated', userId: 'viewer-a' },
      }),
    ])

    assert.equal(fetches, 1)
    assert.deepEqual(
      {
        id: fetchedRequest.id,
        locale: fetchedRequest.locale,
        mediaType: fetchedRequest.mediaType,
        region: fetchedRequest.region,
        scope: fetchedRequest.scope,
      },
      {
        id: 1396,
        locale: 'pt-BR',
        mediaType: 'tv',
        region: 'BR',
        scope: { kind: 'authenticated', userId: 'viewer-a' },
      }
    )
  } finally {
    queryClient.clear()
  }
})

test('mobile summary prefetch bounds concurrent distinct requests', async () => {
  const queryClient = new QueryClient()
  let active = 0
  let maximumActive = 0

  await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      prefetchTitleSummary(queryClient, {
        ...context,
        fetchSummary: async (request) => {
          active += 1
          maximumActive = Math.max(maximumActive, active)
          await new Promise((resolve) => setTimeout(resolve, 5))
          active -= 1
          return { ...summary, id: request.id }
        },
        id: context.id + index,
      })
    )
  )

  assert.equal(maximumActive, 4)
  queryClient.clear()
})

test('mobile full-detail prefetch rejects touch intent without fetching', async () => {
  const queryClient = new QueryClient()
  let fetches = 0

  await assert.rejects(
    prefetchTitleDetailsOnNavigation(queryClient, {
      ...context,
      fetchDetails: async () => {
        fetches += 1
        return { ...summary, overview: 'details' }
      },
      intent: 'touch',
    }),
    /navigation intent/i
  )
  assert.equal(fetches, 0)
  queryClient.clear()
})
