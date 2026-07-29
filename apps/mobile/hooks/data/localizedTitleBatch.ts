import type { QueryClient } from '@tanstack/query-core'
import { seedTitleSummary } from './titleQueries.ts'

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
  const apiOrigin = kinoApiOrigin()
  const response = await fetch(`${apiOrigin}/api/v1/titles/summaries`, {
    body: JSON.stringify(input),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    signal,
  })
  if (!response.ok) throw new Error('Localized title summaries are temporarily unavailable.')
  return response.json() as Promise<LocalizedTitleBatchResponse>
}

function kinoApiOrigin() {
  const configured = process.env.EXPO_PUBLIC_KINO_API_URL?.trim()
  if (!configured) throw new Error('EXPO_PUBLIC_KINO_API_URL is required for title localization.')
  const url = new URL(configured)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_KINO_API_URL must use HTTP or HTTPS.')
  }
  url.pathname = url.pathname.replace(/\/+$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}
