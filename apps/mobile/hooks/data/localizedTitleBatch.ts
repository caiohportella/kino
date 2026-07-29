import {
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
  const response = normalizeLocalizedTitleBatchResponse(await request(input, signal))
  for (const summary of response.summaries) {
    const cacheEntry = toLocalizedTitleSummaryCacheEntry(summary, input)
    seedTitleSummary(queryClient, cacheEntry.input, cacheEntry.summary)
  }
  return response
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
