// TMDb API-related types
import type { MediaType } from './common'

export interface TMDbTitle {
  id: number
  title?: string // For movies
  name?: string // For TV shows
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string // For movies
  first_air_date?: string // For TV shows
  vote_average: number
  vote_count: number
  genre_ids: number[]
  media_type?: MediaType
}

export interface TMDbExternalIds {
  imdb_id: string | null
  facebook_id?: string | null
  instagram_id?: string | null
  twitter_id?: string | null
  tvdb_id?: number | null
  tvrage_id?: number | null
  id: number
}

export interface TMDbMovie extends TMDbTitle {
  title: string
  release_date: string
  runtime?: number
  external_ids?: TMDbExternalIds
}

export interface TMDbTVShow extends TMDbTitle {
  name: string
  first_air_date: string
  episode_run_time?: number[]
  seasons: TMDbSeason[]
  external_ids?: TMDbExternalIds
}

export interface TMDbCast {
  id: number
  name: string
  character?: string
  job?: string // For crew (director, etc.)
  profile_path: string | null
  order?: number
}

export interface TMDbGenre {
  id: number
  name: string
}

export interface TMDbEpisode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  air_date: string
  still_path: string | null
  vote_average: number
  vote_count: number
}

export interface TMDbSeason {
  id: number
  name: string
  overview: string
  season_number: number
  episode_count: number
  poster_path: string | null
  air_date: string
}

export interface TMDbImage {
  aspect_ratio: number
  height: number
  width: number
  file_path: string
  vote_average: number
  vote_count: number
}

export interface TMDbPersonExternalIds {
  imdb_id: string | null
  facebook_id: string | null
  instagram_id: string | null
  twitter_id: string | null
  tiktok_id?: string | null
  youtube_id?: string | null
  id?: number
}

export interface TMDbPerson {
  id: number
  name: string
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  profile_path: string | null
  known_for_department: string
  external_ids?: TMDbPersonExternalIds
}

export interface TMDbPersonCredit extends TMDbTitle {
  character?: string
  job?: string
  department?: string
  credit_id: string
}

export interface TMDbPersonCombinedCredits {
  cast: TMDbPersonCredit[]
  crew: TMDbPersonCredit[]
}

