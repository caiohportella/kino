import {
  LOCALIZED_TITLE_GC_TIME,
  LOCALIZED_TITLE_STALE_TIME,
  titleQueryKeys,
} from '@kino/core/cache'
import type { CacheScope } from '@kino/core/localization'
import type { QueryClient } from '@tanstack/react-query'

export type LocalizedTitleMediaType = 'movie' | 'tv'

export interface LocalizedTitleQueryContext {
  readonly id: number
  readonly locale: string
  readonly mediaType: LocalizedTitleMediaType
  readonly region: string
  readonly scope: CacheScope
}

export interface LocalizedTitleFetchRequest extends LocalizedTitleQueryContext {
  readonly signal?: AbortSignal
}

export interface LocalizedTitleSummary {
  readonly backdropPath: string | null
  readonly id: number
  readonly mediaType: LocalizedTitleMediaType
  readonly posterPath: string | null
  readonly title: string
  readonly year: number | null
}

export interface TitleSummaryQueryInput extends LocalizedTitleQueryContext {
  readonly fetchSummary: (request: LocalizedTitleFetchRequest) => Promise<LocalizedTitleSummary>
}

export interface TitleDetailsQueryInput<Details extends LocalizedTitleSummary>
  extends LocalizedTitleQueryContext {
  readonly enabled?: boolean
  readonly fetchDetails: (request: LocalizedTitleFetchRequest) => Promise<Details>
}

export function titleSummaryQueryOptions(input: TitleSummaryQueryInput) {
  const descriptor = titleQueryKeys.canonical(input)
  return {
    gcTime: LOCALIZED_TITLE_GC_TIME,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      input.fetchSummary({ ...descriptor.context, signal }),
    queryKey: descriptor.summary,
    staleTime: LOCALIZED_TITLE_STALE_TIME,
  }
}

export function titleDetailsQueryOptions<Details extends LocalizedTitleSummary>(
  queryClient: QueryClient,
  input: TitleDetailsQueryInput<Details>
) {
  const descriptor = titleQueryKeys.canonical(input)
  return {
    enabled: input.enabled,
    gcTime: LOCALIZED_TITLE_GC_TIME,
    placeholderData: () => queryClient.getQueryData<LocalizedTitleSummary>(descriptor.summary),
    queryFn: async ({
      signal,
    }: {
      signal: AbortSignal
    }): Promise<Details | LocalizedTitleSummary> =>
      input.fetchDetails({ ...descriptor.context, signal }),
    queryKey: descriptor.details,
    staleTime: LOCALIZED_TITLE_STALE_TIME,
  }
}

export function seedTitleSummary(
  queryClient: QueryClient,
  context: LocalizedTitleQueryContext,
  summary: LocalizedTitleSummary
) {
  queryClient.setQueryData(titleQueryKeys.canonical(context).summary, summary)
}
