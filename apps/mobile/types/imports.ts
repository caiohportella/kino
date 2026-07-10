import type { MediaType, WatchType } from './common'

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
