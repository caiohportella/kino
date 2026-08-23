'use client'

import { getLocale, getRegion, SEARCH_SCHEMA_VERSION_V2 } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/kino'
import { AppPagination } from '@/components/layout/app-pagination'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileCollectionFilters } from '@/components/profile/collections/profile-collection-filters'
import {
  ProfileCollectionGrid,
  type ProfileCollectionGridItem,
  ProfileCollectionGridSkeleton,
} from '@/components/profile/collections/profile-collection-grid'
import { ProfileCollectionShareButton } from '@/components/profile/collections/profile-collection-share-button'
import { useProfileCollection } from '@/hooks/profile/use-profile-sections'
import { localizedTitleKey, useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import {
  countActiveProfileCollectionFilters,
  DEFAULT_PROFILE_COLLECTION_FILTERS,
  filterAndSortProfileCollection,
  type ProfileCollectionFilterState,
  paginateProfileCollection,
  parseProfileCollectionFilters,
  serializeProfileCollectionFilters,
} from '@/lib/profile/profile-collection-filters'
import type { ProfileQueryService } from '@/lib/profile/profile-query-options'
import { createSearchGatewayClient } from '@/lib/search/client'
import { getTmdb } from '@/lib/services'
import { useSettingsStore } from '@/stores/settings-store'

const searchGateway = createSearchGatewayClient()

const PROFILE_COLLECTION_PAGE_SIZE = 72

type VisibilityScope = { kind: 'public' } | { kind: 'authenticated'; userId: string }

export function ProfileCollectionPage({
  description,
  mediaType,
  profileId,
  service,
  shareText,
  title,
  visibilityScope,
  backLabel,
  emptyBody,
  emptyTitle,
  errorBody,
  errorTitle,
  noMatchesBody,
  noMatchesTitle,
  profileHref,
}: {
  description?: string
  mediaType: 'movie' | 'tv'
  profileId: string
  service: ProfileQueryService
  shareText?: string
  title: string
  visibilityScope: VisibilityScope
  backLabel: string
  emptyBody: string
  emptyTitle: string
  errorBody: string
  errorTitle: string
  noMatchesBody: string
  noMatchesTitle: string
  profileHref: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = parseProfileCollectionFilters(new URLSearchParams(searchParams.toString()))

  const collectionQuery = useProfileCollection({
    mediaType,
    profileId,
    service,
    visibilityScope,
  })

  const items = collectionQuery.data ?? []

  const language = useSettingsStore((state) => state.language)

  const localizedSearchQuery = useQuery({
    queryKey: ['profile-collection-localized-search', mediaType, filters.query, language],

    queryFn: ({ signal }) =>
      searchGateway
        .search(
          {
            schemaVersion: SEARCH_SCHEMA_VERSION_V2,
            mode: 'autocomplete',
            query: filters.query,
            locale: getLocale(language),
            region: getRegion(language),
            mediaTypes: [mediaType === 'tv' ? 'series' : 'movie'],
            page: 1,
            limit: 50,
          },
          signal
        )
        .then((response) =>
          response.schemaVersion === SEARCH_SCHEMA_VERSION_V2 ? response.results : []
        ),

    enabled: filters.query.trim().length >= 2,
    staleTime: 60_000,
  })

  const localizedTmdbIds = new Set<number>()

  for (const result of localizedSearchQuery.data ?? []) {
    const expectedEntityType = mediaType === 'tv' ? 'series' : 'movie'

    if (result.entity.entityType === expectedEntityType && result.entity.tmdbId !== undefined) {
      localizedTmdbIds.add(result.entity.tmdbId)
    }
  }

  const filteredItems = filterAndSortProfileCollection(items, filters, mediaType, localizedTmdbIds)

  const pagination = paginateProfileCollection(
    filteredItems,
    filters.page,
    PROFILE_COLLECTION_PAGE_SIZE
  )

  const localizedTitles = useLocalizedTitles(
    pagination.items.map((item) => ({
      tmdbId: item.tmdbId,
      type: item.mediaType,
    }))
  )

  const years = collectFilterYears(items, mediaType)
  const genres = collectGenres(items)

  const gridItems: ProfileCollectionGridItem[] = pagination.items.map((item) => {
    const localized =
      localizedTitles.data[
        localizedTitleKey({
          tmdbId: item.tmdbId,
          type: item.mediaType,
        })
      ]

    const displayTitle = localized?.title ?? item.title
    const posterPath = localized?.posterPath ?? item.posterPath
    const releaseYear = localized?.year ?? item.releaseYear

    return {
      id: item.id,
      mediaType: item.mediaType,
      posterUrl: getTmdb().getImageUrl(posterPath, 'w300'),
      title: displayTitle,
      tmdbId: item.tmdbId,
      year: releaseYear,
    }
  })

  function replaceFilters(nextFilters: ProfileCollectionFilterState) {
    const params = serializeProfileCollectionFilters(nextFilters)
    const query = params.toString()

    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    })
  }

  function handleFilterChange(key: keyof ProfileCollectionFilterState, value: string) {
    if (key === 'page') {
      return
    }

    replaceFilters({
      ...filters,
      [key]: value,
      page: 1,
    })
  }

  function handlePageChange(page: number) {
    replaceFilters({
      ...filters,
      page,
    })
  }

  return (
    <main className="content-frame">
      <Link
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-kino-muted transition-colors hover:text-kino-text focus-ring"
        href={profileHref}
      >
        <ArrowLeft aria-hidden="true" size={16} />
        {backLabel}
      </Link>

      <PageHeader
        action={<ProfileCollectionShareButton text={shareText} title={title} />}
        body={description}
        title={title}
      />

      {collectionQuery.isPending ? (
        <ProfileCollectionGridSkeleton count={12} />
      ) : collectionQuery.isError ? (
        <EmptyState body={errorBody} title={errorTitle} variant="missing" />
      ) : items.length === 0 ? (
        <EmptyState body={emptyBody} title={emptyTitle} variant="profile" />
      ) : (
        <>
          <div className="mb-4 text-sm font-medium text-kino-muted">{pagination.totalItems}</div>

          <ProfileCollectionFilters
            activeCount={countActiveProfileCollectionFilters(filters)}
            genres={genres}
            onChange={handleFilterChange}
            onReset={() =>
              replaceFilters({
                ...DEFAULT_PROFILE_COLLECTION_FILTERS,
              })
            }
            state={filters}
            years={years}
          />

          {pagination.totalItems === 0 ? (
            <EmptyState
              body={noMatchesBody}
              className="min-h-80"
              size="compact"
              title={noMatchesTitle}
              variant="search"
            />
          ) : (
            <>
              {localizedTitles.isPending ? (
                <ProfileCollectionGridSkeleton count={pagination.items.length} />
              ) : (
                <ProfileCollectionGrid items={gridItems} />
              )}

              <AppPagination
                onPageChange={handlePageChange}
                page={pagination.page}
                totalPages={pagination.totalPages}
              />
            </>
          )}
        </>
      )}
    </main>
  )
}

function collectFilterYears(
  items: NonNullable<ReturnType<typeof useProfileCollection>['data']>,
  mediaType: 'movie' | 'tv'
) {
  const years = new Set<string>()

  for (const item of items) {
    if (mediaType === 'movie') {
      for (const event of item.watchEvents) {
        years.add(event.watchedAt.slice(0, 4))
      }

      continue
    }

    for (const pass of item.seriesPasses) {
      years.add(pass.completedAt.slice(0, 4))
    }
  }

  return Array.from(years).sort((left, right) => right.localeCompare(left))
}

function collectGenres(items: NonNullable<ReturnType<typeof useProfileCollection>['data']>) {
  const genres = new Map<number, string>()

  for (const item of items) {
    for (const genre of item.genres) {
      genres.set(genre.id, genre.name)
    }
  }

  return Array.from(genres.entries())
    .map(([id, name]) => ({
      label: name,
      value: String(id),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}
