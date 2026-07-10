// Utility functions to transform TMDb API responses to our app format
import type { TMDbMovie, TMDbTVShow, TMDbCast, TMDbGenre, TitleDetails } from '~/types'
import { getTMDbService } from '~/services/tmdb'

/**
 * Transform TMDb movie data to TitleDetails
 */
export async function transformMovieToTitleDetails(
  movie: TMDbMovie & { genres: TMDbGenre[]; external_ids?: import('~/types').TMDbExternalIds },
  credits: { cast: TMDbCast[]; crew: TMDbCast[] }
): Promise<Omit<TitleDetails, 'averageRating' | 'ratingCount'>> {
  const tmdb = getTMDbService()
  const director = credits.crew.find((person) => person.job === 'Director')

  return {
    id: '', // Will be set when saved to database
    tmdbId: movie.id,
    type: 'movie',
    title: movie.title,
    synopsis: movie.overview || '',
    coverImage: tmdb.getImageUrl(movie.poster_path),
    backdropImage: tmdb.getBackdropUrl(movie.backdrop_path),
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
    status: null,
    genres: movie.genres || [],
    cast: credits.cast.slice(0, 20), // Top 20 cast members
    director: director ? { ...director, job: 'Director' } : undefined,
    runtime: movie.runtime,
    externalIds: movie.external_ids,
  }
}

/**
 * Transform TMDb TV show data to TitleDetails
 */
export async function transformTVToTitleDetails(
  tv: TMDbTVShow & {
    genres: TMDbGenre[]
    number_of_seasons: number
    number_of_episodes: number
    external_ids?: import('~/types').TMDbExternalIds
  },
  credits: { cast: TMDbCast[]; crew: TMDbCast[] }
): Promise<Omit<TitleDetails, 'averageRating' | 'ratingCount'>> {
  const tmdb = getTMDbService()
  const creator = credits.crew.find((person) => person.job === 'Creator')

  return {
    id: '', // Will be set when saved to database
    tmdbId: tv.id,
    type: 'tv',
    title: tv.name,
    synopsis: tv.overview || '',
    coverImage: tmdb.getImageUrl(tv.poster_path),
    backdropImage: tmdb.getBackdropUrl(tv.backdrop_path),
    year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : 0,
    status: tv.status,
    genres: tv.genres || [],
    cast: credits.cast.slice(0, 20), // Top 20 cast members
    director: creator ? { ...creator, job: 'Creator' } : undefined,
    totalSeasons: tv.number_of_seasons,
    totalEpisodes: tv.number_of_episodes,
    seasons: tv.seasons,
    externalIds: tv.external_ids,
  }
}

/**
 * Format rating to display (e.g., 4.5 -> "4.5")
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1)
}

/**
 * Format year from date string
 */
export function formatYear(dateString: string | undefined): number {
  if (!dateString) return 0
  return new Date(dateString).getFullYear()
}

/**
 * Format runtime in minutes to "Xh Ym" format
 */
export function formatRuntime(minutes: number | undefined): string {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`
  }
  if (hours > 0) {
    return `${hours}h`
  }
  return `${mins}m`
}
