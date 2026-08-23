import type { MediaType, TMDbTitle } from '@kino/core'

export type FilteredDiscoverStrategy = 'best-matches' | 'popular' | 'recent' | 'highly-rated'

export interface FilteredDiscoverCriteria {
  mediaType: 'all' | MediaType
  genreIds: number[]
  minRating: number
}

export interface FilteredDiscoverRow {
  id: FilteredDiscoverStrategy
  items: TMDbTitle[]
}

export function createDiscoverFilterParams(
  filters: FilteredDiscoverCriteria
): Record<string, string> {
  const params: Record<string, string> = {}

  if (filters.genreIds.length > 0) {
    params.with_genres = [...filters.genreIds].sort((a, b) => a - b).join(',')
  }

  if (filters.minRating > 0) {
    params['vote_average.gte'] = String(filters.minRating)
  }

  return params
}

export function createDiscoverStrategyParams({
  filters,
  strategy,
  type,
  page = 1,
}: {
  filters: FilteredDiscoverCriteria
  strategy: FilteredDiscoverStrategy
  type: MediaType
  page?: number
}): Record<string, string> {
  const params: Record<string, string> = {
    ...createDiscoverFilterParams(filters),
    page: String(page),
  }

  switch (strategy) {
    case 'best-matches': {
      params.sort_by = 'vote_count.desc'

      if (filters.minRating > 0) {
        params['vote_count.gte'] = '100'
      }

      break
    }

    case 'popular': {
      params.sort_by = 'popularity.desc'

      break
    }

    case 'recent': {
      params.sort_by = type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc'

      const today = new Date().toISOString().slice(0, 10)

      if (type === 'movie') {
        params['primary_release_date.lte'] = today
      } else {
        params['first_air_date.lte'] = today
      }

      if (filters.minRating === 0) {
        params['vote_count.gte'] = '20'
      }

      break
    }

    case 'highly-rated': {
      params.sort_by = 'vote_average.desc'
      params['vote_count.gte'] = '250'

      break
    }
  }

  return params
}

export function mergeBalancedMediaResults(
  movieResults: TMDbTitle[],
  tvResults: TMDbTitle[]
): TMDbTitle[] {
  const length = Math.max(movieResults.length, tvResults.length)

  return Array.from({ length }).flatMap((_, index) => {
    const items: TMDbTitle[] = []

    const movie = movieResults[index]
    const tv = tvResults[index]

    if (movie) {
      items.push(movie)
    }

    if (tv) {
      items.push(tv)
    }

    return items
  })
}

export function mediaIdentity(item: TMDbTitle): string {
  return `${item.media_type}-${item.id}`
}

export function takeUniqueResults(items: TMDbTitle[], seen: Set<string>, limit = 20): TMDbTitle[] {
  const unique: TMDbTitle[] = []

  for (const item of items) {
    const identity = mediaIdentity(item)

    if (seen.has(identity)) {
      continue
    }

    seen.add(identity)
    unique.push(item)

    if (unique.length >= limit) {
      break
    }
  }

  return unique
}
