import { searchQueryKeys } from '@kino/core/cache'
import {
  SEARCH_SCHEMA_VERSION,
  type SearchMediaType,
  type SearchResponseV1,
} from '@kino/core/search'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useReadyLanguage } from '~/hooks/useLanguage'
import { createSearchGateway } from '~/services/search-gateway'
import { resolveKinoApiOrigin } from '~/utils/searchGatewayConfig'

const AUTOCOMPLETE_LIMIT = 5
const FULL_SEARCH_LIMIT = 20

export function useUpstashSearch({
  mediaTypes,
  mode = 'autocomplete',
}: {
  mediaTypes?: readonly SearchMediaType[]
  mode?: 'autocomplete' | 'full'
} = {}) {
  const language = useReadyLanguage()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const region = localeRegion(language ?? 'en')
  const limit = mode === 'autocomplete' ? AUTOCOMPLETE_LIMIT : FULL_SEARCH_LIMIT
  const requestPage = mode === 'autocomplete' ? 1 : page
  const mediaTypesKey = [...(mediaTypes || [])].sort().join(',')
  const gateway = useMemo(
    () =>
      createSearchGateway({
        origin: resolveKinoApiOrigin(process.env.EXPO_PUBLIC_KINO_API_URL),
      }),
    []
  )
  const searchQuery = useQuery<SearchResponseV1>({
    enabled: Boolean(language && query),
    queryFn: ({ signal }) =>
      gateway.search(
        {
          schemaVersion: SEARCH_SCHEMA_VERSION,
          query,
          locale: language ?? 'en',
          region,
          mediaTypes,
          page: requestPage,
          limit,
        },
        signal
      ),
    queryKey: searchQueryKeys.results({
      filters: { limit, mediaTypes: mediaTypesKey, mode, schemaVersion: SEARCH_SCHEMA_VERSION },
      locale: language ?? 'en',
      page: requestPage,
      query,
      region,
      scope: { kind: 'public' },
    }),
    retry: 1,
    staleTime: 60_000,
  })

  const search = useCallback((value: string, nextPage = 1) => {
    setPage(nextPage)
    setQuery(value.trim())
  }, [])
  const clearResults = useCallback(() => {
    setQuery('')
    setPage(1)
  }, [])

  return {
    clearResults,
    error: searchQuery.error,
    loading: searchQuery.isFetching,
    nextPage: searchQuery.data?.nextPage,
    response: searchQuery.data,
    search,
  }
}

function localeRegion(locale: string) {
  return (
    {
      en: 'US',
      fr: 'FR',
      it: 'IT',
      no: 'NO',
      pt: 'BR',
    }[locale] ?? 'US'
  )
}
