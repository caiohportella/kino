import type { MediaType } from './common'
import type { TMDbGenre, TMDbCast, TMDbSeason, TMDbExternalIds } from './tmdb'

export interface TitleDetails {
  id: string
  tmdbId: number
  type: MediaType
  title: string
  synopsis: string
  coverImage: string | null
  backdropImage: string | null
  year: number
  genres: TMDbGenre[]
  cast: TMDbCast[]
  director?: TMDbCast
  averageRating: number
  ratingCount: number
  externalIds?: TMDbExternalIds
  // For TV shows
  seasons?: TMDbSeason[]
  totalSeasons?: number
  totalEpisodes?: number
  // For movies
  runtime?: number
}
