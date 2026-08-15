'use client'

import type { CarouselTitle, MediaType, TMDbGenre, TMDbTitle } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type DiscoverFilterState, DiscoverFilters } from '@/components/discover/discover-filters'
import { Poster } from '@/components/kino'
import { useMediaPoster } from '@/hooks/use-media-poster'
import { useTranslation } from '@/lib/i18n'
import { getTmdb } from '@/lib/services'
import { TrendingCarousel } from '../carousel/trending-carousel'
import { AppPagination } from '../layout/app-pagination'
import { MediaSection } from '../media/media-section'
import { MobileDiscoverFilters } from '../mobile/mobile-discover-filters'

interface DiscoverClientProps {
  genres: TMDbGenre[]
  movieGenres: TMDbGenre[]
  tvGenres: TMDbGenre[]

  trending: CarouselTitle[]
  popularMovies: CarouselTitle[]
  popularTV: CarouselTitle[]
  nowPlaying: TMDbTitle[]
  topRated: TMDbTitle[]
  upcoming: TMDbTitle[]
}

function DiscoverResultCard({ item }: { item: TMDbTitle }) {
  const { href, poster, prefetch, title, year } = useMediaPoster(item)

  return (
    <Link
      className="group min-w-0 focus-ring"
      href={href}
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      <Poster className="w-full rounded-md" details={{ year }} src={poster} title={title} />
    </Link>
  )
}

export function DiscoverClient({
  genres,
  movieGenres,
  tvGenres,
  trending,
  popularMovies,
  popularTV,
  nowPlaying,
  topRated,
  upcoming,
}: DiscoverClientProps) {
  const { t } = useTranslation()

  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [page, setPage] = useState(() => {
    const value = Number(searchParams.get('page'))

    return Number.isInteger(value) && value > 0 ? value : 1
  })

  function updatePage(nextPage: number) {
    setPage(nextPage)

    const params = new URLSearchParams(window.location.search)

    if (nextPage > 1) {
      params.set('page', String(nextPage))
    } else {
      params.delete('page')
    }

    const query = params.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname

    window.history.replaceState(window.history.state, '', nextUrl)
  }

  function filtersFromSearchParams(): DiscoverFilterState {
    const mediaTypeParam = searchParams.get('type')
    const genresParam = searchParams.get('genres')
    const ratingParam = searchParams.get('rating')

    return {
      mediaType: mediaTypeParam === 'movie' || mediaTypeParam === 'tv' ? mediaTypeParam : 'all',

      genreIds: genresParam
        ? genresParam
            .split(',')
            .map(Number)
            .filter((id) => Number.isInteger(id) && genres.some((genre) => genre.id === id))
        : [],

      minRating: (() => {
        const rating = Number(ratingParam)

        return Number.isFinite(rating) && rating >= 0 && rating <= 9 ? rating : 0
      })(),
    }
  }

  const [filters, setFilters] = useState<DiscoverFilterState>(filtersFromSearchParams)

  const filtering =
    filters.mediaType !== 'all' || filters.genreIds.length > 0 || filters.minRating > 0

  const filteredQuery = useQuery({
    queryKey: [
      'discover-filtered',
      filters.mediaType,
      filters.genreIds.join(','),
      filters.minRating,
      page,
    ],
    queryFn: async () => {
      const tmdb = getTmdb()

      const params: Record<string, string> = {
        page: String(page),
        sort_by: filters.minRating > 0 ? 'vote_average.asc' : 'popularity.desc',
      }

      if (filters.genreIds.length > 0) {
        params.with_genres = filters.genreIds.join(',')
      }

      if (filters.minRating > 0) {
        params['vote_average.gte'] = String(filters.minRating)
        params['vote_count.gte'] = '50'
      }

      const types: MediaType[] = filters.mediaType === 'all' ? ['movie', 'tv'] : [filters.mediaType]

      const responses = await Promise.all(types.map((type) => tmdb.discoverMedia(type, params)))

      const results = responses.flatMap((response) => response.results)

      const movieResults =
        filters.mediaType === 'all' ? sortResults(responses[0]?.results ?? []) : []

      const tvResults = filters.mediaType === 'all' ? sortResults(responses[1]?.results ?? []) : []

      const singleTypeResults = filters.mediaType === 'all' ? results : sortResults(results)

      const balancedResults: TMDbTitle[] =
        filters.mediaType === 'all'
          ? Array.from({
              length: Math.max(movieResults.length, tvResults.length),
            }).flatMap((_, index) => {
              const items: TMDbTitle[] = []

              const movie = movieResults[index]
              const tv = tvResults[index]

              if (movie) items.push(movie)
              if (tv) items.push(tv)

              return items
            })
          : singleTypeResults

      const totalResults =
        filters.mediaType === 'all'
          ? responses.reduce((sum, response) => sum + response.totalResults, 0)
          : (responses[0]?.totalResults ?? 0)

      const totalPages = Math.max(1, Math.ceil(totalResults / 20))

      function sortResults(items: TMDbTitle[]) {
        if (filters.minRating <= 0) {
          return items
        }

        return [...items].sort((a, b) => {
          if (a.vote_average !== b.vote_average) {
            return a.vote_average - b.vote_average
          }

          return b.vote_count - a.vote_count
        })
      }

      const pagedResults = balancedResults.slice(0, 20)

      return {
        results: pagedResults,
        totalPages,
      }
    },
    enabled: filtering,
  })

  function resetFilters() {
    updateFilters({
      mediaType: 'all',
      genreIds: [],
      minRating: 0,
    })
  }

  function updateFilters(next: DiscoverFilterState) {
    const validGenres =
      next.mediaType === 'movie' ? movieGenres : next.mediaType === 'tv' ? tvGenres : genres

    const validGenreIds = new Set(validGenres.map((genre) => genre.id))

    const sanitized: DiscoverFilterState = {
      ...next,
      genreIds: next.genreIds.filter((id) => validGenreIds.has(id)),
    }

    setFilters(sanitized)

    setPage(1)

    const params = new URLSearchParams()

    if (sanitized.mediaType !== 'all') {
      params.set('type', sanitized.mediaType)
    }

    if (sanitized.genreIds.length > 0) {
      params.set('genres', sanitized.genreIds.join(','))
    }

    if (sanitized.minRating > 0) {
      params.set('rating', String(sanitized.minRating))
    }

    const query = params.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname

    window.history.replaceState(window.history.state, '', nextUrl)
  }

  const selectedGenreNames = filters.genreIds
    .map((id) => {
      const genre = genres.find((item) => item.id === id)

      return t(`genres.${id}`, {
        defaultValue: genre?.name ?? '',
      })
    })
    .filter(Boolean)

  const availableGenres =
    filters.mediaType === 'movie' ? movieGenres : filters.mediaType === 'tv' ? tvGenres : genres

  const filteredTitle =
    selectedGenreNames.length > 0
      ? selectedGenreNames.join(', ')
      : filters.mediaType === 'movie'
        ? t('search.movies')
        : filters.mediaType === 'tv'
          ? t('search.tvShows')
          : t('tabs.home')

  return (
    <>
      <div className="mb-8 flex items-center gap-2">
        {/* Desktop */}
        <div className="hidden md:block">
          <DiscoverFilters
            genres={availableGenres}
            onChange={updateFilters}
            onReset={resetFilters}
            value={filters}
          />
        </div>

        {/* Mobile */}
        <MobileDiscoverFilters
          genres={availableGenres}
          onChange={updateFilters}
          onReset={resetFilters}
          value={filters}
        />
      </div>

      {filtering ? (
        <div className="grid gap-6">
          <div>
            <h2 className="text-xl font-semibold text-kino-text">{filteredTitle}</h2>

            {filters.minRating > 0 ? (
              <p className="mt-1 text-sm text-kino-muted">
                {t('search.minimumRating')}: {filters.minRating}+
              </p>
            ) : null}
          </div>

          {filteredQuery.isLoading ? (
            <div className="poster-grid">
              {Array.from({ length: 12 }).map((_, index) => (
                <div className="aspect-2/3 animate-pulse rounded-md bg-white/6" key={index} />
              ))}
            </div>
          ) : null}

          {!filteredQuery.isLoading &&
          !filteredQuery.isError &&
          filteredQuery.data?.results.length ? (
            <>
              <div className="poster-grid">
                {filteredQuery.data.results.map((item) => (
                  <DiscoverResultCard item={item} key={`${item.media_type}-${item.id}`} />
                ))}
              </div>

              {filteredQuery.data.totalPages > 1 ? (
                <AppPagination
                  label={t('search.pages')}
                  onPageChange={updatePage}
                  page={page}
                  totalPages={filteredQuery.data.totalPages}
                />
              ) : null}
            </>
          ) : null}

          {!filteredQuery.isLoading &&
          !filteredQuery.isError &&
          !filteredQuery.data?.results.length ? (
            <div className="py-12 text-center text-sm text-kino-muted">{t('search.noResults')}</div>
          ) : null}

          {filteredQuery.isError ? (
            <div className="py-12 text-center text-sm text-kino-muted">{t('common.failed')}</div>
          ) : null}
        </div>
      ) : (
        <>
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-kino-text">{t('home.trending')}</h2>
            </div>

            <TrendingCarousel items={trending} />
          </section>

          <MediaSection items={popularMovies} title={t('home.popularMovies')} />

          <MediaSection items={popularTV} title={t('home.popularTV')} />

          <MediaSection items={nowPlaying} title={t('home.newReleases')} />

          <MediaSection items={topRated} title={t('home.topRated')} />

          <MediaSection items={upcoming} title={t('home.comingSoon')} />
        </>
      )}
    </>
  )
}
