// Types for raw Supabase table rows.
// These types use snake_case to match the database column names.

import type { MediaType } from './common'
import type { TMDbGenre, TMDbCast, TMDbSeason } from './tmdb'

export interface SupabaseTitle {
  id: string
  tmdb_id: number
  type: MediaType
  title: string
  synopsis: string
  cover_image: string | null
  backdrop_image: string | null
  release_year: number
  genres: TMDbGenre[]
  cast: TMDbCast[]
  director?: TMDbCast
  runtime?: number
  total_seasons?: number
  total_episodes?: number
  seasons_metadata: {
    season_number: number
    episode_count: number
    air_date: string
  }[]
}

export interface SupabaseTitleRating {
  id: string
  user_id: string
  title_id: string
  rating: number
  watch_type: 'first-time' | 'rewatch'
  watched_at: string
  created_at: string
  updated_at: string
  notes?: string
  // from join
  title?: SupabaseTitle
}

export interface SupabaseEpisodeRating {
  id: string
  user_id: string
  title_id: string
  season_number: number
  episode_number: number
  rating: number | null
  watch_type: 'first-time' | 'rewatch'
  watched_at: string
  created_at: string
  updated_at: string
  notes?: string
  // from join
  title?: SupabaseTitle
}

export interface SupabaseWatchDiaryEntry {
  id: string
  user_id: string
  title_id: string
  watched_at: string
  watch_type: 'first-time' | 'rewatch'
  notes?: string
  created_at: string
  updated_at: string
}

export interface SupabaseWatchlist {
  id: string
  user_id: string
  name: string
  description?: string | null
  thumbnail?: string
  is_shared: boolean
  share_code: string | null
  created_at: string
  updated_at: string
}

export interface SupabaseWatchlistItem {
  id: string
  watchlist_id: string
  title_id: string
  added_at: string
  added_by: string
}

export interface WatchedMovie extends SupabaseTitle {
  rating: number
  watched_at: string
  user_rating_id: string
}

export interface WatchedSeries extends SupabaseTitle {
  total_episodes: number
  latest_rating: number | null
  latest_watched_at: string
  last_episode: {
    season: number
    episode: number
  }
  watched_episode_count: number
  next_episode: {
    season: number
    episode: number
  } | null
  is_series_completed: boolean
}
