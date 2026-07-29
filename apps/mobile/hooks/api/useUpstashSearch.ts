import { searchQueryKeys } from '@kino/core/cache'
import { SEARCH_SCHEMA_VERSION, type SearchResponseV1 } from '@kino/core/search'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useReadyLanguage } from '~/hooks/useLanguage'
import { createSearchGateway } from '~/services/search-gateway'
import type { TMDbTitle } from '~/types'
import { resolveKinoApiOrigin } from '~/utils/searchGatewayConfig'

const SEARCH_LIMIT = 20

export function useUpstashSearch() {
  const language = useReadyLanguage()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const region = localeRegion(language ?? 'en')
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
          page,
          limit: SEARCH_LIMIT,
        },
        signal
      ),
    queryKey: searchQueryKeys.results({
      filters: { limit: SEARCH_LIMIT, schemaVersion: SEARCH_SCHEMA_VERSION },
      locale: language ?? 'en',
      page,
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
    results: toTitles(searchQuery.data),
    search,
  }
}

function toTitles(response?: SearchResponseV1): TMDbTitle[] {
  return (response?.groups || [])
    .filter((group) => group.type === 'movies' || group.type === 'series')
    .flatMap((group) =>
      group.results.flatMap(({ entity, score }) => {
        if (!entity.tmdbId) return []
        const type = entity.entityType === 'series' ? 'tv' : 'movie'
        return [
          {
            id: entity.tmdbId,
            backdrop_path: null,
            genre_ids: [],
            media_type: type,
            name: type === 'tv' ? entity.title : undefined,
            overview: entity.summary || '',
            poster_path: entity.imageUrl || null,
            release_date: type === 'movie' && entity.year ? `${entity.year}-01-01` : '',
            first_air_date: type === 'tv' && entity.year ? `${entity.year}-01-01` : '',
            title: type === 'movie' ? entity.title : undefined,
            vote_average: score,
            vote_count: entity.voteCount || 0,
          } satisfies TMDbTitle,
        ]
      })
    )
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
