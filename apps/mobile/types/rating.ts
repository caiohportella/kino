// Rating-related types
import type { WatchType } from './common'

export interface UserRating {
  id: string
  userId: string
  titleId: string
  rating: number | null // 1-5 stars, or null if just watched
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
  rating: number | null // 1-5 stars, or null if just watched
  watchType: WatchType
  watchedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface SeasonRating {
  seasonNumber: number
  averageRating: number
  episodeCount: number
  ratedEpisodes: number
}

export interface StarBreakdown {
  [key: number]: number // rating (1-5) -> count
}

export interface TitleRatingStats {
  averageRating: number
  totalRatings: number
  starBreakdown: StarBreakdown
}
