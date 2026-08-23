import type { TMDbTitle } from '@kino/core'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  type FilteredDiscoverMorePage,
  fetchFilteredDiscoverMorePage,
} from '@/lib/discover/filtered-more-query'
import { type FilteredDiscoverCriteria, mediaIdentity } from '@/lib/discover/filtered-rows'
import { getTmdb } from '@/lib/services'

export function useFilteredDiscoverMore({
  filters,
  enabled,
  excludeItems,
}: {
  filters: FilteredDiscoverCriteria
  enabled: boolean
  excludeItems: TMDbTitle[]
}) {
  const excludedIds = useMemo(() => new Set(excludeItems.map(mediaIdentity)), [excludeItems])

  return useInfiniteQuery({
    queryKey: [
      'discover-filtered-more',
      filters.mediaType,
      [...filters.genreIds].sort((a, b) => a - b).join(','),
      filters.minRating,
    ],

    queryFn: ({ pageParam }) =>
      fetchFilteredDiscoverMorePage({
        tmdb: getTmdb(),
        filters,
        page: pageParam,
      }),

    initialPageParam: 2,

    getNextPageParam: (lastPage: FilteredDiscoverMorePage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined
    },

    enabled,

    select: (data) => {
      const seen = new Set(excludedIds)

      const pages = data.pages.map((page) => {
        const items = page.items.filter((item) => {
          const identity = mediaIdentity(item)

          if (seen.has(identity)) {
            return false
          }

          seen.add(identity)

          return true
        })

        return {
          ...page,
          items,
        }
      })

      return {
        ...data,
        pages,
      }
    },
  })
}
