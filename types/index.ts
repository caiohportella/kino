// Core types for Kino app

export type MediaType = 'movie' | 'tv';

export type WatchType = 'first-time' | 'rewatch';

export interface TMDbTitle {
  id: number;
  title?: string; // For movies
  name?: string; // For TV shows
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string; // For movies
  first_air_date?: string; // For TV shows
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  media_type?: MediaType;
}

export interface TMDbMovie extends TMDbTitle {
  title: string;
  release_date: string;
  runtime?: number;
}

export interface TMDbTVShow extends TMDbTitle {
  name: string;
  first_air_date: string;
  episode_run_time?: number[];
}

export interface TMDbCast {
  id: number;
  name: string;
  character?: string;
  job?: string; // For crew (director, etc.)
  profile_path: string | null;
  order?: number;
}

export interface TMDbGenre {
  id: number;
  name: string;
}

export interface TMDbEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TMDbSeason {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
  air_date: string;
}

export interface TitleDetails {
  id: string;
  tmdbId: number;
  type: MediaType;
  title: string;
  synopsis: string;
  coverImage: string | null;
  backdropImage: string | null;
  year: number;
  genres: TMDbGenre[];
  cast: TMDbCast[];
  director?: TMDbCast;
  averageRating: number;
  ratingCount: number;
  // For TV shows
  seasons?: TMDbSeason[];
  totalSeasons?: number;
  // For movies
  runtime?: number;
}

export interface UserRating {
  id: string;
  userId: string;
  titleId: string;
  rating: number; // 1-5 stars
  watchType: WatchType;
  watchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EpisodeRating {
  id: string;
  userId: string;
  titleId: string;
  seasonNumber: number;
  episodeNumber: number;
  rating: number; // 1-5 stars
  watchType: WatchType;
  watchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchDiaryEntry {
  id: string;
  userId: string;
  titleId: string;
  watchedAt: Date;
  watchType: WatchType;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Watchlist {
  id: string;
  userId: string; // The creator/owner ID
  name: string;
  description?: string;
  thumbnail?: string;
  isShared: boolean;
  shareCode?: string; // 8-char alphanumeric code for sharing
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchlistItem {
  id: string;
  watchlistId: string;
  titleId: string;
  addedAt: Date;
  addedBy: string;
}

export interface WatchlistCollaborator {
  id: string;
  watchlistId: string;
  userId: string;
  canEdit: boolean;
  addedAt: Date;
}

export interface SeasonRating {
  seasonNumber: number;
  averageRating: number;
  episodeCount: number;
  ratedEpisodes: number;
}

export interface StarBreakdown {
  [key: number]: number; // rating (1-5) -> count
}

export interface TitleRatingStats {
  averageRating: number;
  totalRatings: number;
  starBreakdown: StarBreakdown;
}

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}
