import type { MediaType } from '@kino/core'
import { TMDbService, transformMovieToTitleDetails, transformTVToTitleDetails } from '@kino/core'
import { cache } from 'react'

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
      ? transformMovieToTitleDetails(tmdb, await tmdb.getMovieDetails(tmdbId), await tmdb.getMovieCredits(tmdbId))
      : transformTVToTitleDetails(tmdb, await tmdb.getTVDetails(tmdbId), await tmdb.getTVCredits(tmdbId))

  return {
    ...details,
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

export const getPersonSeoData = cache(async (personId: number, language = 'en') => {
  const tmdb = createTmdb(language)
  return tmdb.getPersonDetails(personId)
})
