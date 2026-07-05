// Profile-specific types for watched movies and series

export interface WatchedMovie {
  id: string
  tmdb_id: number
  type: 'movie'
  title: string
  synopsis: string
  cover_image: string | null
  backdrop_image: string | null
  release_year: number
  genres: { id: number; name: string }[]
  cast: { id: number; name: string; character?: string; profile_path: string | null }[]
  director?: { id: number; name: string; profile_path: string | null }
  runtime?: number
  rating: number
  watched_at: string
  user_rating_id: string
}

export interface WatchedSeries {
  id: string
  tmdb_id: number
  type: 'tv'
  title: string
  synopsis: string
  cover_image: string | null
  backdrop_image: string | null
  release_year: number
  genres: { id: number; name: string }[]
  cast: { id: number; name: string; character?: string; profile_path: string | null }[]
  director?: { id: number; name: string; profile_path: string | null }
  total_seasons?: number
  total_episodes?: number
  watched_episode_count: number
  latest_rating: number
  latest_watched_at: string
  last_episode: {
    season: number
    episode: number
  }
  next_episode?: {
    season: number
    episode: number
    air_date?: string
  } | null
  is_series_completed?: boolean
}
