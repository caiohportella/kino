import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient } from '@tanstack/query-core'
import {
  LOCALIZED_TITLE_GC_TIME,
  LOCALIZED_TITLE_STALE_TIME,
} from '../../../packages/core/src/cache/policies.ts'
import { prefetchTitleDetailsOnNavigation, prefetchTitleSummary } from './title-prefetch.ts'
import {
  seedTitleSummary,
  titleDetailsQueryOptions,
  titleSummaryQueryOptions,
} from './title-queries.ts'

const context = {
  id: 238,
  locale: 'pt-BR',
  mediaType: 'movie',
  region: 'BR',
  scope: { kind: 'public' },
}

const summary = {
  backdropPath: '/backdrop-pt.jpg',
  id: 238,
  mediaType: 'movie',
  posterPath: '/poster-pt.jpg',
  title: 'O Poderoso Chefão',
  year: 1972,
}

test('web detail placeholder uses only a compatible locale-region-scope summary', () => {
  const queryClient = new QueryClient()
  seedTitleSummary(queryClient, context, summary)

  const compatible = titleDetailsQueryOptions(queryClient, {
    ...context,
    fetchDetails: async () => ({ ...summary, overview: 'details' }),
  })
  const wrongLocale = titleDetailsQueryOptions(queryClient, {
    ...context,
    fetchDetails: async () => ({ ...summary, overview: 'details' }),
    locale: 'en-US',
  })

  assert.deepEqual(compatible.placeholderData(), summary)
  assert.equal(wrongLocale.placeholderData(), undefined)
  assert.notDeepEqual(compatible.queryKey, wrongLocale.queryKey)
  queryClient.clear()
})

test('web summary options use the named localized cache policy', () => {
  const options = titleSummaryQueryOptions({
    ...context,
    fetchSummary: async () => summary,
  })

  assert.equal(options.staleTime, LOCALIZED_TITLE_STALE_TIME)
  assert.equal(options.gcTime, LOCALIZED_TITLE_GC_TIME)
})

test('concurrent identical web summary prefetches invoke the fetcher once', async () => {
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

test('web equivalent cache inputs deduplicate with the canonical fetch request', async () => {
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
        id: 238,
        locale: 'pt-BR',
        mediaType: 'movie',
        region: 'BR',
        scope: { kind: 'authenticated', userId: 'viewer-a' },
      }
    )
  } finally {
    queryClient.clear()
  }
})

test('web summary prefetch bounds concurrent distinct requests', async () => {
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

test('web full-detail prefetch rejects non-navigation intent without fetching', async () => {
  const queryClient = new QueryClient()
  let fetches = 0

  await assert.rejects(
    prefetchTitleDetailsOnNavigation(queryClient, {
      ...context,
      fetchDetails: async () => {
        fetches += 1
        return { ...summary, overview: 'details' }
      },
      intent: 'hover',
    }),
    /navigation intent/i
  )
  assert.equal(fetches, 0)
  queryClient.clear()
})
