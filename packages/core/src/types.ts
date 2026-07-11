export type MediaType = 'movie' | 'tv'
export type WatchType = 'first-time' | 'rewatch'

export interface TMDbTitle {
  id: number
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
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
  genres: TMDbGenre[]
  external_ids?: TMDbExternalIds
}

export interface TMDbTVShow extends TMDbTitle {
  name: string
  first_air_date: string
  status?: string
  episode_run_time?: number[]
  seasons: TMDbSeason[]
  genres: TMDbGenre[]
  number_of_seasons: number
  number_of_episodes: number
  external_ids?: TMDbExternalIds
}

export interface TMDbCast {
  id: number
  name: string
  character?: string
  job?: string
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

export interface TMDbCredits {
  cast: TMDbCast[]
  crew: TMDbCast[]
}

export interface TMDbPersonExternalIds {
  imdb_id: string | null
  facebook_id: string | null
  instagram_id: string | null
  twitter_id: string | null
  tiktok_id?: string | null
  youtube_id?: string | null
  wikidata_id?: string | null
  id?: number
}

export interface TMDbPerson {
  id: number
  name: string
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  place_of_death?: string | null
  homepage?: string | null
  profile_path: string | null
  known_for_department: string
  external_ids?: TMDbPersonExternalIds
  combined_credits?: TMDbPersonCombinedCredits
}

export interface TMDbPersonCredit extends TMDbTitle {
  character?: string
  job?: string
  department?: string
  credit_id: string
  media_type: MediaType
}

export interface TMDbPersonCombinedCredits {
  cast: TMDbPersonCredit[]
  crew: TMDbPersonCredit[]
}

export interface TitleDetails {
  id: string
  tmdbId: number
  type: MediaType
  title: string
  synopsis: string
  coverImage: string | null
  backdropImage: string | null
  year: number
  status?: string | null
  genres: TMDbGenre[]
  cast: TMDbCast[]
  director?: TMDbCast
  averageRating: number
  ratingCount: number
  externalIds?: TMDbExternalIds
  seasons?: TMDbSeason[]
  totalSeasons?: number
  totalEpisodes?: number
  runtime?: number
}

export interface UserRating {
  id: string
  userId: string
  titleId: string
  rating: number | null
  watchType: WatchType
  watchedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface EpisodeRating {
  id: string
  userId: string
  titleId: string
  seasonNumber: number
  episodeNumber: number
  rating: number | null
  watchType: WatchType
  watchedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface WatchDiaryEntry {
  id: string
  userId: string
  titleId: string
  watchedAt: Date
  watchType: WatchType
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface UIDiaryEntry {
  id: string
  titleId: string
  tmdbId: number
  type: MediaType
  titleName: string
  releaseYear: number
  coverImage: string | null
  genres: TMDbGenre[]
  runtime?: number
  watchedAt: string
  watchType: WatchType
  notes?: string
  rating?: number
  averageRating: number
  ratingCount: number
  createdAt: string
  updatedAt: string
}

export interface Watchlist {
  id: string
  userId: string
  name: string
  description?: string
  thumbnail?: string
  isShared: boolean
  shareCode?: string
  createdAt: Date
  updatedAt: Date
}

export interface WatchlistItem {
  id: string
  watchlistId: string
  titleId: string
  addedAt: Date
  addedBy: string
}

export interface WatchlistItemDetails extends WatchlistItem {
  title: PersistedTitle
  addedByUser?: Pick<UserProfile, 'id' | 'avatar_url' | 'display_name' | 'username'>
}

export interface UserProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  banner_url?: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface FollowerInfo extends UserProfile {
  followedAt: string
  isMutual: boolean
  mutualSince?: string
}

export interface WatchedMovie extends PersistedTitle {
  type: 'movie'
  rating: number
  watched_at: string
  user_rating_id: string
}

export interface WatchedSeries extends PersistedTitle {
  type: 'tv'
  watched_episode_count: number
  latest_rating: number | null
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

export interface PersistedTitle {
  id: string
  tmdb_id: number
  type: MediaType
  title: string
  synopsis: string | null
  cover_image: string | null
  backdrop_image: string | null
  release_year: number
  genres: TMDbGenre[]
  cast: TMDbCast[]
  director?: TMDbCast | null
  runtime?: number | null
  total_seasons?: number | null
  total_episodes?: number | null
  seasons_metadata?: SeasonMetadata[] | null
}

export interface SeasonMetadata {
  season_number: number
  episode_count: number
  air_date?: string | null
}

export interface TitleRatingStats {
  averageRating: number
  totalRatings: number
  starBreakdown: Record<number, number>
}

export type ImportSource = 'tvtime' | 'letterboxd'
export type ImportConfidence = 'high' | 'medium' | 'low'

export interface ImportEpisodePayload {
  seasonNumber: number
  episodeNumber: number
  watchedAt: string
  rating: number | null
  watchType: WatchType
}

export interface ImportMoviePayload {
  watchedAt: string
  rating: number | null
  watchType: WatchType
}

export interface ImportTitleItem {
  id: string
  source: ImportSource
  mediaType: MediaType
  title: string
  year: number | null
  watchedAt: string
  rating: number | null
  watchType: WatchType
  notes?: string
  count: number
  include: boolean
  confidence: ImportConfidence
  issue?: string | null
  sourceLabel: string
  movieWatches?: ImportMoviePayload[]
  tvEpisodes?: ImportEpisodePayload[]
  importStatus?: 'idle' | 'processing' | 'success' | 'skipped' | 'failed'
  importError?: string
}

export interface ParsedImportResult {
  source: ImportSource | null
  fileName: string
  items: ImportTitleItem[]
  warnings: string[]
  errors: string[]
}
