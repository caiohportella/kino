import { LOCALIZED_TITLE_STALE_TIME, titleQueryKeys } from '@kino/core/cache'
import {
  LOCALIZED_TITLE_BATCH_MAX_ITEMS,
  type LocalizedTitleBatchInput,
  type LocalizedTitleBatchResponse,
  normalizeLocalizedTitleBatchResponse,
  type ResolvedLocalizedTitleSummary,
  toLocalizedTitleSummaryCacheEntry,
} from '@kino/core/localization'
import type { QueryClient } from '@tanstack/react-query'
import { seedTitleSummary } from '../title/title-queries.ts'

export type {
  LocalizedTitleBatchInput,
  LocalizedTitleBatchItem,
  LocalizedTitleBatchResponse,
  ResolvedLocalizedTitleSummary,
} from '@kino/core/localization'

export async function hydrateLocalizedTitleBatch(
  queryClient: QueryClient,
  input: LocalizedTitleBatchInput,
  request: (
    input: LocalizedTitleBatchInput,
    signal?: AbortSignal
  ) => Promise<LocalizedTitleBatchResponse>,
  signal?: AbortSignal
) {
  const cachedSummaries = new Map<string, ResolvedLocalizedTitleSummary>()

  const misses = input.items.filter((item) => {
    const queryKey = titleQueryKeys.summary({
      id: item.tmdbId,
      locale: input.locale,
      mediaType: item.type,
      region: input.region,
      scope: { kind: 'public' },
    })

    const state = queryClient.getQueryState(queryKey)

    const summary = state?.data as ResolvedLocalizedTitleSummary | undefined

    const fresh =
      state !== undefined &&
      summary !== undefined &&
      !state.isInvalidated &&
      Date.now() - state.dataUpdatedAt < LOCALIZED_TITLE_STALE_TIME

    if (!fresh) {
      return true
    }

    cachedSummaries.set(`${item.type}:${item.tmdbId}`, summary)

    return false
  })

  const response = await requestChunkedLocalizedTitleBatch(
    {
      ...input,
      items: misses,
    },
    request,
    signal
  )

  const summaries = new Map(cachedSummaries)

  for (const summary of response.summaries) {
    const cacheEntry = toLocalizedTitleSummaryCacheEntry(summary, input)

    seedTitleSummary(queryClient, cacheEntry.input, cacheEntry.summary)

    summaries.set(`${summary.mediaType}:${summary.id}`, summary)
  }

  return {
    ...response,
    summaries: input.items.flatMap((item) => {
      const summary = summaries.get(`${item.type}:${item.tmdbId}`)

      return summary ? [summary] : []
    }),
  }
}

async function requestChunkedLocalizedTitleBatch(
  input: LocalizedTitleBatchInput,
  request: (
    input: LocalizedTitleBatchInput,
    signal?: AbortSignal
  ) => Promise<LocalizedTitleBatchResponse>,
  signal?: AbortSignal
): Promise<LocalizedTitleBatchResponse> {
  const chunks = chunkItems(input.items)
  const responses: LocalizedTitleBatchResponse[] = new Array(chunks.length)
  let cursor = 0

  await Promise.all(
    Array.from({ length: Math.min(3, chunks.length) }, async () => {
      while (cursor < chunks.length) {
        signal?.throwIfAborted()
        const index = cursor++
        const items = chunks[index]!
        try {
          responses[index] = normalizeLocalizedTitleBatchResponse(
            await request({ ...input, items }, signal)
          )
        } catch (error) {
          if (signal?.aborted) throw error
          responses[index] = {
            schemaVersion: input.schemaVersion,
            errors: items,
            missing: [],
            summaries: [],
          }
        }
      }
    })
  )

  return {
    schemaVersion: input.schemaVersion,
    errors: responses.flatMap((response) => response.errors),
    missing: responses.flatMap((response) => response.missing),
    summaries: responses.flatMap((response) => response.summaries),
  }
}

function chunkItems(items: LocalizedTitleBatchInput['items']) {
  return Array.from(
    { length: Math.ceil(items.length / LOCALIZED_TITLE_BATCH_MAX_ITEMS) },
    (_, index) =>
      items.slice(
        index * LOCALIZED_TITLE_BATCH_MAX_ITEMS,
        (index + 1) * LOCALIZED_TITLE_BATCH_MAX_ITEMS
      )
  )
}

export async function requestLocalizedTitleBatch(
  input: LocalizedTitleBatchInput,
  signal?: AbortSignal
): Promise<LocalizedTitleBatchResponse> {
  const response = await fetch('/api/v1/titles/summaries', {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    signal,
  })
  if (!response.ok) throw new Error('Localized title summaries are temporarily unavailable.')
  return normalizeLocalizedTitleBatchResponse(await response.json())
}
