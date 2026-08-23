'use client'

import type { TMDbTitle } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { MediaRow } from '@/components/media/media-row'
import { MediaSection } from '@/components/media/media-section'
import { Button } from '@/components/ui/button'
import { useFilteredDiscoverMore } from '@/hooks/discover/use-filtered-discover-more'
import { fetchFilteredDiscoverRows } from '@/lib/discover/filtered-row-query'
import {
  type FilteredDiscoverCriteria,
  type FilteredDiscoverStrategy,
} from '@/lib/discover/filtered-rows'
import { useTranslation } from '@/lib/localization/i18n'
import { getTmdb } from '@/lib/services'

export function FilteredDiscoverResults({ filters }: { filters: FilteredDiscoverCriteria }) {
  const { t } = useTranslation()

  const normalizedGenreIds = [...filters.genreIds].sort((a, b) => a - b)

  const rowsQuery = useQuery({
    queryKey: [
      'discover-filtered-rows',
      filters.mediaType,
      normalizedGenreIds.join(','),
      filters.minRating,
    ],

    queryFn: () =>
      fetchFilteredDiscoverRows({
        tmdb: getTmdb(),
        filters: {
          ...filters,
          genreIds: normalizedGenreIds,
        },
      }),
  })

  const rows = rowsQuery.data ?? []

  const primaryItems = useMemo(() => rows.flatMap((row) => row.items), [rows])

  const moreQuery = useFilteredDiscoverMore({
    filters: {
      ...filters,
      genreIds: normalizedGenreIds,
    },
    enabled: rowsQuery.isSuccess && rows.length > 0,
    excludeItems: primaryItems,
  })

  const moreItems = moreQuery.data?.pages.flatMap((page) => page.items) ?? []

  if (rowsQuery.isLoading) {
    return <FilteredDiscoverRowsSkeleton />
  }

  if (rowsQuery.isError) {
    return (
      <div className="py-12 text-center text-sm text-kino-muted">
        {t('common.failed', {
          defaultValue: 'Something went wrong',
        })}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-kino-muted">
        {t('search.noResults', {
          defaultValue: 'No results found',
        })}
      </div>
    )
  }

  return (
    <div>
      {rows.map((row) => (
        <MediaSection items={row.items} key={row.id} title={getFilteredRowTitle(row.id, t)} />
      ))}

      {moreItems.length > 0 ? (
        <MediaSection
          items={moreItems}
          title={t('discover.filtered.moreToDiscover', {
            defaultValue: 'More to discover',
          })}
        />
      ) : null}

      {moreQuery.hasNextPage ? (
        <div className="flex justify-center pb-4">
          <Button
            disabled={moreQuery.isFetchingNextPage}
            onClick={() => moreQuery.fetchNextPage()}
            type="button"
            variant="outline"
          >
            {moreQuery.isFetchingNextPage
              ? t('common.loading', {
                  defaultValue: 'Loading…',
                })
              : t('discover.filtered.loadMore', {
                  defaultValue: 'Load more',
                })}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function getFilteredRowTitle(
  strategy: FilteredDiscoverStrategy,
  t: ReturnType<typeof useTranslation>['t']
) {
  switch (strategy) {
    case 'best-matches':
      return t('discover.filtered.bestMatches', {
        defaultValue: 'Best matches',
      })

    case 'popular':
      return t('discover.filtered.popular', {
        defaultValue: 'Popular',
      })

    case 'recent':
      return t('discover.filtered.recentlyReleased', {
        defaultValue: 'Recently released',
      })

    case 'highly-rated':
      return t('discover.filtered.highlyRated', {
        defaultValue: 'Highly rated',
      })
  }
}

function FilteredDiscoverRowsSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <section className="mb-10" key={rowIndex}>
          <div className="mb-4 h-6 w-36 animate-pulse rounded bg-white/6" />

          <MediaRow>
            {Array.from({ length: 8 }).map((_, itemIndex) => (
              <div className="min-w-0" key={itemIndex}>
                <div className="aspect-2/3 w-full animate-pulse rounded-md bg-white/6" />
              </div>
            ))}
          </MediaRow>
        </section>
      ))}
    </div>
  )
}
