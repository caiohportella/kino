import type { MediaType, TMDbTitle } from '@kino/core'
import { TMDbService, transformMovieToTitleDetails, transformTVToTitleDetails } from '@kino/core'
import {
  getLocale,
  getRegion,
  type KinoLanguage,
  SUPPORTED_LANGUAGES,
} from '@kino/core/locale-config'
import { cache } from 'react'
import { slugify } from '@/lib/routes'
import { decodeHtmlEntities } from '@/lib/text'
import { getPersonImagePaths } from '@/lib/tmdb/person-visuals'
import { getDiscoverFeedQueries } from '../discover/feed-queries'
import {
  hasUpcomingRerelease,
  isFirstRunRecentRelease,
  isFirstRunUpcomingRelease,
} from '../discover/release-classification'
import { enrichTitlesWithPalette } from './enrich-titles-palette'

function createTmdb(language: string) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_TMDB_API_KEY.')
  }
  const tmdb = new TMDbService(apiKey)
  tmdb.setLanguage(language)
  return tmdb
}

export function getRegionForLanguage(language: string) {
  return isKinoLanguage(language) ? getRegion(language) : 'US'
}

export const getTitleSeoData = cache(async (tmdbId: number, type: MediaType, language = 'en') => {
  const tmdb = createTmdb(language)
  const details =
    type === 'movie'
      ? transformMovieToTitleDetails(
          tmdb,
          await tmdb.getMovieDetails(tmdbId),
          await tmdb.getMovieCredits(tmdbId)
        )
      : transformTVToTitleDetails(
          tmdb,
          await tmdb.getTVDetails(tmdbId),
          await tmdb.getTVCredits(tmdbId)
        )

  return {
    ...details,
    title: decodeHtmlEntities(details.title),
    synopsis: decodeHtmlEntities(details.synopsis),
    genres: details.genres.map((genre) => ({
      ...genre,
      name: decodeHtmlEntities(genre.name),
    })),
    type,
  }
})

export const getTitleSeoDataById = cache(async (tmdbId: number, language = 'en') => {
  try {
    return await getTitleSeoData(tmdbId, 'movie', language)
  } catch {
    return await getTitleSeoData(tmdbId, 'tv', language)
  }
})

export const getTitleSeoDataBySegment = cache(
  async (tmdbId: number, slug: string, language = 'en') => {
    const movie = await getTitleSeoData(tmdbId, 'movie', language).catch(() => null)
    if (movie && (!slug || slugify(movie.title) === slug)) return movie

    const series = await getTitleSeoData(tmdbId, 'tv', language).catch(() => null)
    if (series && (!slug || slugify(series.title) === slug)) return series

    if (movie) return movie
    if (series) return series
    throw new Error('Title not found')
  }
)

export const getPersonSeoData = cache(async (personId: number, language = 'en') => {
  const tmdb = createTmdb(language)
  return tmdb.getPersonDetails(personId)
})

export function getPersonVisuals(person: Awaited<ReturnType<typeof getPersonSeoData>>) {
  const tmdb = createTmdb('en')
  const paths = getPersonImagePaths(person)
  return {
    banner: tmdb.getBackdropUrl(paths.bannerPath, 'w1280'),
    portrait: tmdb.getImageUrl(paths.portraitPath, 'w500'),
  }
}

async function getRegionalMovieReleaseDates(tmdb: TMDbService, movieId: number, region: string) {
  const response = await tmdb.getMovieReleaseDates(movieId)

  return (
    response.results.find((result) => result.iso_3166_1 === region.toUpperCase())?.release_dates ??
    []
  )
}

export const getDiscoverData = cache(
  async (language = 'en', region = getRegionForLanguage(language)) => {
    const tmdb = createTmdb(language)
    const feedQueries = getDiscoverFeedQueries()

    const [
      trending,
      popularMoviesResponse,
      popularTV,
      movieGenres,
      tvGenres,
      newReleasesResponse,
      upcomingResponse,
    ] = await Promise.all([
      tmdb.getTrending('all', 'day'),

      tmdb.discoverMedia('movie', {
        region,
        ...feedQueries.popularMovies.params,
      }),

      tmdb.getPopularTV(),

      tmdb.getGenres('movie'),
      tmdb.getGenres('tv'),

      tmdb.discoverMedia('movie', {
        region,
        ...feedQueries.newReleases.params,
      }),

      tmdb.discoverMedia('movie', {
        region,
        ...feedQueries.upcoming.params,
      }),
    ])

    const popularMovies = popularMoviesResponse.results

    const newReleaseCandidates = await Promise.all(
      newReleasesResponse.results.map(async (movie) => ({
        movie,
        releases: await getRegionalMovieReleaseDates(tmdb, movie.id, region),
      }))
    )

    const newReleases = newReleaseCandidates
      .filter(({ movie, releases }) => {
        if (releases.length === 0) {
          const releaseDate = movie.release_date

          return Boolean(
            releaseDate &&
              releaseDate >= feedQueries.window.recentStart &&
              releaseDate <= feedQueries.window.today
          )
        }

        return isFirstRunRecentRelease(
          releases,
          feedQueries.window.recentStart,
          feedQueries.window.today
        )
      })
      .map(({ movie }) => movie)

    const upcomingCandidates = await Promise.all(
      upcomingResponse.results.map(async (movie) => ({
        movie,
        releases: await getRegionalMovieReleaseDates(tmdb, movie.id, region),
      }))
    )

    const upcoming = upcomingCandidates
      .filter(({ movie, releases }) => {
        if (releases.length === 0) {
          const releaseDate = movie.release_date

          return Boolean(
            releaseDate &&
              releaseDate >= feedQueries.window.tomorrow &&
              releaseDate <= feedQueries.window.upcomingEnd
          )
        }

        return isFirstRunUpcomingRelease(
          releases,
          feedQueries.window.tomorrow,
          feedQueries.window.upcomingEnd
        )
      })
      .map(({ movie }) => movie)
    const rereleases = upcomingCandidates
      .filter(({ releases }) =>
        hasUpcomingRerelease(releases, feedQueries.window.today, feedQueries.window.upcomingEnd)
      )
      .map(({ movie }) => movie)

    const releasedPopularTV = popularTV.filter((show) => {
      if (!show.first_air_date) return true

      return show.first_air_date <= feedQueries.popularMovies.params['release_date.lte']
    })

    const genres = Array.from(
      new Map([...movieGenres, ...tvGenres].map((genre) => [genre.id, genre])).values()
    ).sort((a, b) => a.name.localeCompare(b.name))

    const [enrichedTrending, enrichedPopularMovies, enrichedPopularTV] = await Promise.all([
      enrichTitlesWithPalette(trending),
      enrichTitlesWithPalette(popularMovies),
      enrichTitlesWithPalette(releasedPopularTV),
    ])

    return {
      trending: enrichedTrending,
      popularMovies: enrichedPopularMovies,
      popularTV: enrichedPopularTV,
      newReleases,
      upcoming,
      rereleases,
      genres,
      movieGenres,
      tvGenres,
    }
  }
)

function isKinoLanguage(language: string): language is KinoLanguage {
  return SUPPORTED_LANGUAGES.includes(language as KinoLanguage)
}
