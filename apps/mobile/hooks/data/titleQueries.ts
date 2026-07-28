import type { QueryClient } from '@tanstack/query-core'
import {
  LOCALIZED_TITLE_GC_TIME,
  LOCALIZED_TITLE_STALE_TIME,
} from '../../../../packages/core/src/cache/policies.ts'
import { titleQueryKeys } from '../../../../packages/core/src/cache/query-keys.ts'
import type { CacheScope } from '../../../../packages/core/src/localization/types.ts'

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
  readonly fetchDetails: (request: LocalizedTitleFetchRequest) => Promise<Details>
}

export function titleSummaryQueryOptions(input: TitleSummaryQueryInput) {
  return {
    gcTime: LOCALIZED_TITLE_GC_TIME,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      input.fetchSummary({ ...queryContext(input), signal }),
    queryKey: titleQueryKeys.summary(queryContext(input)),
    staleTime: LOCALIZED_TITLE_STALE_TIME,
  }
}

export function titleDetailsQueryOptions<Details extends LocalizedTitleSummary>(
  queryClient: QueryClient,
  input: TitleDetailsQueryInput<Details>
) {
  const context = queryContext(input)
  return {
    gcTime: LOCALIZED_TITLE_GC_TIME,
    placeholderData: () =>
      queryClient.getQueryData<LocalizedTitleSummary>(titleQueryKeys.summary(context)),
    queryFn: ({ signal }: { signal: AbortSignal }) => input.fetchDetails({ ...context, signal }),
    queryKey: titleQueryKeys.details(context),
    staleTime: LOCALIZED_TITLE_STALE_TIME,
  }
}

export function seedTitleSummary(
  queryClient: QueryClient,
  context: LocalizedTitleQueryContext,
  summary: LocalizedTitleSummary
) {
  queryClient.setQueryData(titleQueryKeys.summary(queryContext(context)), summary)
}

function queryContext(input: LocalizedTitleQueryContext): LocalizedTitleQueryContext {
  return {
    id: input.id,
    locale: input.locale,
    mediaType: input.mediaType,
    region: input.region,
    scope: input.scope,
  }
}
