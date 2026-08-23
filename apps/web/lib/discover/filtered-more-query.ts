import type { MediaType, TMDbTitle } from '@kino/core'
import {
  createDiscoverStrategyParams,
  type FilteredDiscoverCriteria,
  mergeBalancedMediaResults,
} from './filtered-rows.ts'

interface DiscoverMediaResponse {
  results: TMDbTitle[]
  totalPages: number
  totalResults: number
}

interface DiscoverMediaClient {
  discoverMedia(type: MediaType, params?: Record<string, string>): Promise<DiscoverMediaResponse>
}

export interface FilteredDiscoverMorePage {
  items: TMDbTitle[]
  page: number
  hasMore: boolean
}

export async function fetchFilteredDiscoverMorePage({
  tmdb,
  filters,
  page,
}: {
  tmdb: DiscoverMediaClient
  filters: FilteredDiscoverCriteria
  page: number
}): Promise<FilteredDiscoverMorePage> {
  const types: MediaType[] = filters.mediaType === 'all' ? ['movie', 'tv'] : [filters.mediaType]

  const responses = await Promise.all(
    types.map(async (type) => {
      const params = createDiscoverStrategyParams({
        filters,
        strategy: 'best-matches',
        type,
        page,
      })

      return tmdb.discoverMedia(type, params)
    })
  )

  if (filters.mediaType !== 'all') {
    const response = responses[0]

    return {
      items: response?.results ?? [],
      page,
      hasMore: page < (response?.totalPages ?? 0),
    }
  }

  const movieResponse = responses[0]
  const tvResponse = responses[1]

  return {
    items: mergeBalancedMediaResults(movieResponse?.results ?? [], tvResponse?.results ?? []),
    page,
    hasMore: page < Math.max(movieResponse?.totalPages ?? 0, tvResponse?.totalPages ?? 0),
  }
}
