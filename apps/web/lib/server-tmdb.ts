import type { MediaType } from '@kino/core'
import { TMDbService, transformMovieToTitleDetails, transformTVToTitleDetails } from '@kino/core'
import { cache } from 'react'
import { getPersonImagePaths } from '@/lib/person-visuals'
import { slugify } from '@/lib/routes'
import { decodeHtmlEntities } from '@/lib/text'

function createTmdb(language: string) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_TMDB_API_KEY.')
  }
  const tmdb = new TMDbService(apiKey)
  tmdb.setLanguage(language)
  return tmdb
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
