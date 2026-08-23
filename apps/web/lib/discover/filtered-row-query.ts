import type { MediaType, TMDbTitle } from '@kino/core'
import {
  createDiscoverStrategyParams,
  type FilteredDiscoverCriteria,
  type FilteredDiscoverRow,
  type FilteredDiscoverStrategy,
  mergeBalancedMediaResults,
  takeUniqueResults,
} from './filtered-rows.ts'

interface DiscoverMediaResponse {
  results: TMDbTitle[]
  totalPages: number
  totalResults: number
}

interface DiscoverMediaClient {
  discoverMedia(type: MediaType, params?: Record<string, string>): Promise<DiscoverMediaResponse>
}

const FILTERED_DISCOVER_STRATEGIES: FilteredDiscoverStrategy[] = [
  'best-matches',
  'popular',
  'recent',
  'highly-rated',
]

const MIN_ROW_ITEMS = 4
const MAX_ROW_ITEMS = 20

export async function fetchFilteredDiscoverRows({
  tmdb,
  filters,
}: {
  tmdb: DiscoverMediaClient
  filters: FilteredDiscoverCriteria
}): Promise<FilteredDiscoverRow[]> {
  const rowResults = await Promise.all(
    FILTERED_DISCOVER_STRATEGIES.map(async (strategy) => {
      const items = await fetchStrategyResults({
        tmdb,
        filters,
        strategy,
      })

      return {
        id: strategy,
        items,
      }
    })
  )

  return deduplicateRows(rowResults)
}

async function fetchStrategyResults({
  tmdb,
  filters,
  strategy,
}: {
  tmdb: DiscoverMediaClient
  filters: FilteredDiscoverCriteria
  strategy: FilteredDiscoverStrategy
}): Promise<TMDbTitle[]> {
  const types: MediaType[] = filters.mediaType === 'all' ? ['movie', 'tv'] : [filters.mediaType]

  const responses = await Promise.all(
    types.map(async (type) => {
      const params = createDiscoverStrategyParams({
        filters,
        strategy,
        type,
      })

      return tmdb.discoverMedia(type, params)
    })
  )

  if (filters.mediaType !== 'all') {
    return responses[0]?.results ?? []
  }

  const movieResults = responses[0]?.results ?? []
  const tvResults = responses[1]?.results ?? []

  return mergeBalancedMediaResults(movieResults, tvResults)
}

function deduplicateRows(rows: FilteredDiscoverRow[]): FilteredDiscoverRow[] {
  const seen = new Set<string>()
  const deduplicated: FilteredDiscoverRow[] = []

  for (const row of rows) {
    const items = takeUniqueResults(row.items, seen, MAX_ROW_ITEMS)

    if (items.length < MIN_ROW_ITEMS) {
      continue
    }

    deduplicated.push({
      ...row,
      items,
    })
  }

  return deduplicated
}
