import type { QueryClient } from '@tanstack/query-core'
import { seedTitleSummary } from './title-queries.ts'

export interface LocalizedTitleBatchItem {
  readonly tmdbId: number
  readonly type: 'movie' | 'tv'
}

export interface ResolvedLocalizedTitleSummary {
  readonly backdropPath: string | null
  readonly id: number
  readonly mediaType: 'movie' | 'tv'
  readonly posterPath: string | null
  readonly posterResolution: {
    readonly locale: string
    readonly source: 'tmdb-localized-details'
  }
  readonly title: string
  readonly year: number | null
}

export interface LocalizedTitleBatchResponse {
  readonly errors: LocalizedTitleBatchItem[]
  readonly missing: LocalizedTitleBatchItem[]
  readonly summaries: ResolvedLocalizedTitleSummary[]
}

export interface LocalizedTitleBatchInput {
  readonly items: LocalizedTitleBatchItem[]
  readonly locale: string
  readonly region: string
}

export async function hydrateLocalizedTitleBatch(
  queryClient: QueryClient,
  input: LocalizedTitleBatchInput,
  request: (
    input: LocalizedTitleBatchInput,
    signal?: AbortSignal
  ) => Promise<LocalizedTitleBatchResponse>,
  signal?: AbortSignal
) {
  const response = await request(input, signal)
  for (const summary of response.summaries) {
    seedTitleSummary(
      queryClient,
      {
        id: summary.id,
        locale: input.locale,
        mediaType: summary.mediaType,
        region: input.region,
        scope: { kind: 'public' },
      },
      summary
    )
  }
  return response
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
  return response.json() as Promise<LocalizedTitleBatchResponse>
}
