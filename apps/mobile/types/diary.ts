// Diary-related types
import type { WatchType } from './common'

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
  type: 'movie' | 'tv'
  titleName: string
  releaseYear: number
  coverImage: string | null
  watchedAt: string
  watchType: 'first-time' | 'rewatch'
  notes?: string
  rating?: number
}
