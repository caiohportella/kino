export type MediaType = 'movie' | 'tv'
export type WatchType = 'first-time' | 'rewatch'
export type OgImageKind = 'profile' | 'title' | 'person' | 'watchlist' | 'settings'

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

export interface CarouselTitle extends TMDbTitle {
  paletteColor?: string
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
  production_companies?: TMDbProductionCompany[]
  external_ids?: TMDbExternalIds
  belongs_to_collection?: TMDbCollectionSummary | null
}

export interface TMDbCollectionSummary {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
}

export interface TMDbCollection extends TMDbCollectionSummary {
  overview: string
  parts: TMDbTitle[]
}

export interface TMDbTVShow extends TMDbTitle {
  name: string
  first_air_date: string
  status?: string
  episode_run_time?: number[]
  seasons: TMDbSeason[]
  genres: TMDbGenre[]
  production_companies?: Array<{
    id: number
    name: string
    logo_path: string | null
    origin_country: string
  }>
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
  gender?: number | null
}

export interface TMDbGenre {
  id: number
  name: string
}

export interface TMDbProductionCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country?: string | null
}

export interface TMDbEpisode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  air_date: string
  runtime?: number | null
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

export interface TMDbVideo {
  id: string
  iso_639_1: string | null
  iso_3166_1: string | null
  key: string
  name: string
  official: boolean
  published_at: string
  site: string
  type: string
}

export interface TMDbVideoResponse {
  id: number
  results: TMDbVideo[]
}

export interface TMDbWatchProvider {
  display_priority?: number
  logo_path: string | null
  provider_id: number
  provider_name: string
}

export interface TMDbWatchProviderRegion {
  ads?: TMDbWatchProvider[]
  buy?: TMDbWatchProvider[]
  flatrate?: TMDbWatchProvider[]
  free?: TMDbWatchProvider[]
  link?: string
  rent?: TMDbWatchProvider[]
}

export interface TMDbWatchProviderResponse {
  id: number
  results: Record<string, TMDbWatchProviderRegion>
}

export type WatchProviderCategory = 'stream' | 'free' | 'ads' | 'rent' | 'buy'

export interface NormalizedWatchProvider extends TMDbWatchProvider {
  category: WatchProviderCategory
}

export interface NormalizedWatchProviders {
  groups: Partial<Record<WatchProviderCategory, NormalizedWatchProvider[]>>
  link: string | null
  region: string
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
  known_for?: TMDbTitle[]
  external_ids?: TMDbPersonExternalIds
  combined_credits?: TMDbPersonCombinedCredits
}

export type SearchResult =
  | {
      kind: 'title'
      id: number
      mediaType: MediaType
      name: string
      imagePath: string | null
      year?: number
      media: TMDbTitle & {
        readonly cast?: readonly string[]
        readonly number_of_seasons?: number
        readonly last_air_date?: string
      }
    }
  | {
      kind: 'person'
      id: number
      name: string
      avatarUrl: string | null
      backgroundUrl: string | null
      summary?: string
    }
  | {
      kind: 'user'
      id: string
      name: string
      username: string
      avatarUrl: string | null
      backgroundUrl: string | null
    }

export interface FollowRelationship {
  isFollowing: boolean
  isFollowedBy: boolean
  isMutual: boolean
  mutualSince?: string
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
  productionCompanies?: TMDbProductionCompany[]
  averageRating: number
  ratingCount: number
  externalIds?: TMDbExternalIds
  seasons?: TMDbSeason[]
  totalSeasons?: number
  totalEpisodes?: number
  runtime?: number
  episodeRuntime?: number | null
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
  runtimeMinutes: number | null
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
  visibility: WatchlistVisibility
  isShared: boolean
  shareCode?: string
  createdAt: Date
  updatedAt: Date
}

export interface WatchlistPreviewTitle {
  id: string
  tmdbId: number
  type: PersistedTitle['type']
  title: string
  coverImage?: string
  watched: boolean
}

export interface WatchlistParticipantPreview {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface UserWatchlistSummary extends Watchlist {
  titleCount: number;
  watchedCount: number;
  previewTitles: WatchlistPreviewTitle[];
  participants: WatchlistParticipantPreview[];
  lastItemAddedAt?: Date;
}

export type WatchlistVisibility = 'private' | 'shared' | 'public'

export interface PublicWatchlistSummary extends Watchlist {
  coverVersion: string
  titleCount: number
  coverImages: string[]
  owner?: Pick<UserProfile, 'id' | 'avatar_url' | 'display_name' | 'username'>
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
  isSelf: boolean
  isFollowing: boolean
  isFollowedBy: boolean
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
  is_caught_up?: boolean
  watched_episode_keys?: string[]
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
  production_companies?: TMDbProductionCompany[] | null
  runtime?: number | null
  episode_runtime?: number | null
  total_seasons?: number | null
  total_episodes?: number | null
  seasons_metadata?: SeasonMetadata[] | null
}

export interface ProfileLifetimeStats {
  moviesWatched: number
  episodesWatched: number
  ratingsMade: number
  timeWatchedMinutes: number
}

export interface ProfileMediaStats {
  seriesWatched: number
  movieRatings: {
    average: number | null
    ratedCount: number
  }
  seriesRatings: {
    average: number | null
    ratedCount: number
  }
}

export interface ProfileGenreStat {
  genreId: number
  name: string
  count: number
  percentage: number
  watchTimeMinutes?: number
}

export interface ProfileRatingBucket {
  rating: number
  count: number
  percentage: number
}

export interface ProfileRatedTitleStat {
  titleId: string
  title: string
  rating: number
  ratingCount: number
}

export interface ProfileStudioStat {
  id: number
  name: string
  logoPath: string | null
  count: number
  percentage: number
}

export interface ProfileMonthlyRecapPersonStat {
  id: number | string
  name: string
  count: number
  distinctTitles: number
  profilePath?: string | null
}

export interface ProfileRatingStats {
  averageRating: number | null
  movieAverageRating: number | null
  seriesAverageRating: number | null
  totalRatings: number
  distribution: ProfileRatingBucket[]
  fiveStarRate: number
  mostRatedGenre: ProfileRatedCategoryStat | null
  highestRatedGenre: ProfileRatedCategoryStat | null
  highestRatedDecade: ProfileRatedDecadeStat | null
  highestRatedStudio: ProfileRatedCategoryStat | null
  highestRatedActor: ProfileRatedCategoryStat | null
  highestRatedActress: ProfileRatedCategoryStat | null

  highestRatedMovie: ProfileRatedTitleStat | null
  lowestRatedMovie: ProfileRatedTitleStat | null
  highestRatedSeries: ProfileRatedTitleStat | null
  lowestRatedSeries: ProfileRatedTitleStat | null
}

export interface ProfileRatedCategoryStat {
  id?: number
  name: string
  average: number
  count: number
  titleCount: number
}

export interface ProfileRatedDecadeStat {
  startYear: number
  average: number
  count: number
  titleCount: number
}

export interface ProfileMediaSplit {
  movies: number
  series: number
  moviePercentage: number
  seriesPercentage: number
  dominantType: 'movie' | 'series' | null
}

export interface ProfileViewingBreakdownStats {
  movieTimeWatchedMinutes: number
  tvTimeWatchedMinutes: number
  averageMovieRuntimeMinutes: number
  averageEpisodesPerSeries: number
  longestBingeEpisodes: number
  longestMovieStreakDays: number
  longestSeriesStreakDays: number
  studioStats: ProfileStudioStat[]
  weekdayMediaSplit: ProfileMediaSplit
  weekendMediaSplit: ProfileMediaSplit
}

export interface ProfileMonthlyRecapTitle {
  titleId: string
  tmdbId: number
  title: string
  mediaType: MediaType
  count: number
  rating: number | null
  coverImage?: string | null
  watchTimeMinutes?: number
  watchedEpisodeCount?: number
}

export interface ProfileMonthlyRecapSeries {
  titleId: string
  tmdbId: number
  title: string
  count: number
  seasonCount?: number | null
  episodeCount?: number | null
  rating?: number | null
  coverImage?: string | null
  watchTimeMinutes?: number
  percentageOfTvTime?: number
}

export interface ProfileMonthlyRecapActivityDay {
  date: string
  entries: number
  moviesWatched: number
  episodesWatched: number
  minutes: number
}

export interface ProfileMonthlyRecapComparison {
  moviesDelta: number
  episodesDelta: number
  timeWatchedMinutesDelta: number
  ratingsDelta: number
}

export interface ProfileMonthlyRecap {
  year: number
  month: number
  moviesWatched: number
  episodesWatched: number
  timeWatchedMinutes: number
  ratingsMade: number
  rewatches: number
  activeDays: number
  dailyActivity: ProfileMonthlyRecapActivityDay[]
  highestRated: ProfileMonthlyRecapTitle | null
  lowestRated: ProfileMonthlyRecapTitle | null
  topRatedMovies: ProfileMonthlyRecapTitle[]
  topRatedSeries: ProfileMonthlyRecapTitle[]
  topTitles: ProfileMonthlyRecapTitle[]
  topGenres: ProfileGenreStat[]
  mostWatchedSeries: ProfileMonthlyRecapSeries[]
  finishedSeries: ProfileMonthlyRecapSeries[]
  mostWatchedStudio: ProfileStudioStat | null
  topActor: ProfileMonthlyRecapPersonStat | null
  highestRatedStudio: ProfileRatedCategoryStat | null
  highestRatedActor: ProfileRatedCategoryStat | null
  highestRatedActress: ProfileRatedCategoryStat | null
  highestRatedGenre: ProfileRatedCategoryStat | null
  highestRatedDecade: ProfileRatedDecadeStat | null
  previousMonthComparison: ProfileMonthlyRecapComparison
  uniqueTitlesWatched: number
  averageRating: number | null
}

export interface ProfileLifetimeRecap {
  moviesWatched: number
  episodesWatched: number
  timeWatchedMinutes: number
  ratingsMade: number
  topRatedMovies: ProfileMonthlyRecapTitle[]
  topRatedSeries: ProfileMonthlyRecapTitle[]
  topGenres: ProfileGenreStat[]
  mostRatedGenre: ProfileRatedCategoryStat | null
  highestRatedStudio: ProfileRatedCategoryStat | null
  highestRatedActor: ProfileRatedCategoryStat | null
  highestRatedActress: ProfileRatedCategoryStat | null
  highestRatedGenre: ProfileRatedCategoryStat | null
  highestRatedDecade: ProfileRatedDecadeStat | null
}

export interface ProfileCollectionWatchEvent {
  id: string
  watchedAt: string
  watchType: WatchType
  seasonNumber?: number
  episodeNumber?: number
  runtimeMinutes?: number | null
}

export interface ProfileSeriesWatchPass {
  passNumber: number
  completedAt: string
}

export interface ProfileCollectionItem {
  id: string
  tmdbId: number
  mediaType: MediaType
  title: string
  originalTitle?: string
  releaseYear: number | null
  genres: TMDbGenre[]
  posterPath: string | null
  userRating: number | null
  averageRating: number | null
  ratingCount: number
  tmdbRating: number | null
  tmdbVoteCount: number
  tmdbPopularity: number
  runtimeMinutes: number | null
  latestWatchedAt: string | null
  latestActivityAt: string | null
  watchCount: number
  watchEvents: ProfileCollectionWatchEvent[]
  seriesPasses: ProfileSeriesWatchPass[]
  requiredEpisodes?: Array<{
    seasonNumber: number
    episodeNumber: number
  }>
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

export type ImportSource = 'letterboxd'
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
