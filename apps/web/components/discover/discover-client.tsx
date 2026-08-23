'use client'

import type { CarouselTitle, TMDbGenre, TMDbTitle } from '@kino/core'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { TrendingCarousel } from '@/components/carousel/trending-carousel'
import { DiscoverCollectionResults } from '@/components/discover/discover-collection-results'
import { type DiscoverFilterState, DiscoverFilters } from '@/components/discover/discover-filters'
import { DiscoverFriendsActivity } from '@/components/discover/discover-friends-activity'
import { DiscoverPersonalizedRow } from '@/components/discover/discover-personalized-row'
import { DiscoverUpdatesSection } from '@/components/discover/discover-updates-section'
import { ExploreCollections } from '@/components/discover/explore-collections'
import { FilteredDiscoverResults } from '@/components/discover/filtered-discover-results'
import { MobileDiscoverFilters } from '@/components/layout/mobile-discover-filters'
import { MediaSection } from '@/components/media/media-section'

import { usePersonalizedDiscoverRows } from '@/hooks/discover/use-personalized-discover-rows'
import type { DiscoverCollectionId } from '@/lib/discover/collections'
import {
  normalizeDiscoverFilterState,
  readDiscoverUrlState,
  writeDiscoverCollectionUrl,
  writeDiscoverFilterUrl,
} from '@/lib/discover/discover-url-state'
import { mergePopularNow } from '@/lib/discover/presentation'
import {
  buildDiscoverSectionOrder,
  type DiscoverSectionDescriptor,
} from '@/lib/discover/section-ordering'
import type { DiscoverSeriesUpdateItem } from '@/lib/discover/series-updates'
import { useTranslation } from '@/lib/localization/i18n'

interface DiscoverClientProps {
  genres: TMDbGenre[]
  movieGenres: TMDbGenre[]
  tvGenres: TMDbGenre[]
  trending: CarouselTitle[]
  popularMovies: CarouselTitle[]
  popularTV: CarouselTitle[]
  upcoming: TMDbTitle[]
  rereleases: TMDbTitle[]
  seriesUpdates: DiscoverSeriesUpdateItem[]
  personalizedNewReleases: TMDbTitle[]
  personalizedNewSeries: TMDbTitle[]
}

export function DiscoverClient({
  genres,
  movieGenres,
  personalizedNewReleases,
  personalizedNewSeries,
  popularMovies,
  popularTV,
  rereleases,
  seriesUpdates,
  trending,
  tvGenres,
  upcoming,
}: DiscoverClientProps) {
  const { t } = useTranslation()

  const pathname = usePathname()
  const searchParams = useSearchParams()

  const popularNow = mergePopularNow(popularMovies, popularTV, 20)

  const personalized = usePersonalizedDiscoverRows()

  const sectionOrder: DiscoverSectionDescriptor[] = buildDiscoverSectionOrder({
    updatesCount: seriesUpdates.length,
    newReleasesCount: personalizedNewReleases.length,
    newSeriesCount: personalizedNewSeries.length,
    upcomingCount: upcoming.length,
    rereleasesCount: rereleases.length,
  })

  const featuredSections = sectionOrder.filter(
    (section) => section.type === 'primary' || section.type === 'updates'
  )

  const catalogSections = sectionOrder.filter(
    (section) => section.type !== 'primary' && section.type !== 'updates'
  )

  const initialUrlState = useMemo(
    () => readDiscoverUrlState(new URLSearchParams(searchParams), genres),
    [genres, searchParams]
  )

  const [activeCollection, setActiveCollection] = useState(() => initialUrlState.collection)

  const [filters, setFilters] = useState<DiscoverFilterState>(() => initialUrlState.filters)

  const hasActiveCollection = activeCollection !== null

  const hasActiveFilters =
    filters.mediaType !== 'all' || filters.genreIds.length > 0 || filters.minRating > 0

  const availableGenres =
    filters.mediaType === 'movie' ? movieGenres : filters.mediaType === 'tv' ? tvGenres : genres

  function updateCollection(nextId: DiscoverCollectionId | null) {
    const nextQuery = writeDiscoverCollectionUrl(
      new URLSearchParams(window.location.search),
      nextId
    )

    const nextParams = new URLSearchParams(nextQuery)

    const nextState = readDiscoverUrlState(nextParams, genres)

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    setActiveCollection(nextState.collection)

    setFilters(nextState.filters)

    window.history.replaceState(window.history.state, '', nextUrl)
  }

  function updateFilters(next: DiscoverFilterState) {
    const validGenres =
      next.mediaType === 'movie' ? movieGenres : next.mediaType === 'tv' ? tvGenres : genres

    const validGenreIds = new Set(validGenres.map((genre) => genre.id))

    const sanitized: DiscoverFilterState = {
      ...next,
      genreIds: next.genreIds.filter((id) => validGenreIds.has(id)),
    }

    /*
     * Filters and collection browsing are
     * mutually exclusive.
     */
    const effectiveFilters = normalizeDiscoverFilterState(sanitized, null)

    const nextQuery = writeDiscoverFilterUrl(
      new URLSearchParams(window.location.search),
      effectiveFilters,
      null
    )

    const nextParams = new URLSearchParams(nextQuery)

    const nextState = readDiscoverUrlState(nextParams, genres)

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    setActiveCollection(nextState.collection)

    setFilters(nextState.filters)

    window.history.replaceState(window.history.state, '', nextUrl)
  }

  function resetFilters() {
    updateFilters({
      mediaType: 'all',
      genreIds: [],
      minRating: 0,
    })
  }

  function renderDiscoverSections(sections: DiscoverSectionDescriptor[]) {
    return sections.map((section) => {
      switch (section.type) {
        case 'primary':
          return (
            <MediaSection
              density="comfortable"
              items={popularNow}
              key="primary"
              title={t('home.popularNow', {
                defaultValue: 'Popular now',
              })}
            />
          )

        case 'updates':
          return <DiscoverUpdatesSection items={seriesUpdates} key="updates" />

        case 'new-releases':
          return (
            <MediaSection
              density="comfortable"
              items={personalizedNewReleases}
              key="new-releases"
              title={t('home.newReleases', {
                defaultValue: 'New releases',
              })}
            />
          )

        case 'new-series':
          return (
            <MediaSection
              density="comfortable"
              items={personalizedNewSeries}
              key="new-series"
              title={t('home.newSeries', {
                defaultValue: 'New series',
              })}
            />
          )

        case 'upcoming':
          return (
            <MediaSection
              density="comfortable"
              items={upcoming}
              key="upcoming"
              title={t('home.upcoming', {
                defaultValue: 'Coming soon',
              })}
            />
          )

        case 'rereleases':
          return (
            <MediaSection
              density="comfortable"
              items={rereleases}
              key="rereleases"
              title={t('home.rereleases', {
                defaultValue: 'Back in theaters',
              })}
            />
          )

        default:
          return null
      }
    })
  }

  return hasActiveCollection ? (
    <DiscoverCollectionResults
      collection={activeCollection}
      onClearAction={() => updateCollection(null)}
    />
  ) : (
    <>
      <section className="mb-12 lg:mb-14">
        <TrendingCarousel items={trending} />
      </section>

      <DiscoverFriendsActivity />

      {renderDiscoverSections(featuredSections)}

      {personalized.rows.slice(0, 2).map((row) => (
        <DiscoverPersonalizedRow key={row.id} row={row} />
      ))}

      <ExploreCollections onSelectAction={updateCollection} />

      {personalized.rows.slice(2).map((row) => (
        <DiscoverPersonalizedRow key={row.id} row={row} />
      ))}

      <section className="mt-14 border-t border-white/8 pt-10 lg:mt-16 lg:pt-12">
        <div className="mb-8">
          <div className="mb-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-kino-accent">
              {t('discover.catalog.eyebrow', {
                defaultValue: 'Explore',
              })}
            </p>

            <h2 className="text-2xl font-semibold tracking-tight text-kino-text md:text-3xl">
              {t('discover.catalog.title', {
                defaultValue: 'Explore the catalog',
              })}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-kino-muted">
              {t('discover.catalog.description', {
                defaultValue: 'Browse movies and series by type, genre, and rating.',
              })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <DiscoverFilters
                genres={availableGenres}
                onChange={updateFilters}
                onReset={resetFilters}
                value={filters}
              />
            </div>

            <MobileDiscoverFilters
              genres={availableGenres}
              onChange={updateFilters}
              onReset={resetFilters}
              value={filters}
            />
          </div>
        </div>

        {hasActiveFilters ? (
          <FilteredDiscoverResults
            filters={{
              mediaType: filters.mediaType,
              genreIds: filters.genreIds,
              minRating: filters.minRating,
            }}
          />
        ) : (
          renderDiscoverSections(catalogSections)
        )}
      </section>
    </>
  )
}
