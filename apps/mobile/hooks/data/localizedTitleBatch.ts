import {
  LOCALIZED_TITLE_BATCH_MAX_ITEMS,
  type LocalizedTitleBatchInput,
  type LocalizedTitleBatchResponse,
  normalizeLocalizedTitleBatchResponse,
  toLocalizedTitleSummaryCacheEntry,
} from '@kino/core/localization'
import type { QueryClient } from '@tanstack/query-core'
import { resolveKinoApiOrigin } from '../../utils/searchGatewayConfig.ts'
import { seedTitleSummary } from './titleQueries.ts'

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
  const response = await requestChunkedLocalizedTitleBatch(input, request, signal)
  for (const summary of response.summaries) {
    const cacheEntry = toLocalizedTitleSummaryCacheEntry(summary, input)
    seedTitleSummary(queryClient, cacheEntry.input, cacheEntry.summary)
  }
  return response
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
        throwIfAborted(signal)
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

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  const error = new Error('Localized title batch was cancelled.')
  error.name = 'AbortError'
  throw error
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
  const apiOrigin = resolveKinoApiOrigin(process.env.EXPO_PUBLIC_KINO_API_URL)
  const response = await fetch(`${apiOrigin}/api/v1/titles/summaries`, {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    signal,
  })
  if (!response.ok) throw new Error('Localized title summaries are temporarily unavailable.')
  return normalizeLocalizedTitleBatchResponse(await response.json())
}
