import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DatabaseService } from '~/services/database'
import type {
  UserProfile,
  TitleDetails,
  Watchlist,
  WatchDiaryEntry,
  UserRating,
  EpisodeRating,
} from '~/types'

const databaseService = new DatabaseService()

// Query Keys
export const TIMELINE_KEYS = {
  all: ['timeline'] as const,
  watchedMovies: (userId: string) => [...TIMELINE_KEYS.all, 'movies', userId] as const,
  watchedSeries: (userId: string) => [...TIMELINE_KEYS.all, 'series', userId] as const,
  diary: (userId: string) => [...TIMELINE_KEYS.all, 'diary', userId] as const,
}

export const USER_KEYS = {
  all: ['user'] as const,
  profile: (userId: string) => [...USER_KEYS.all, 'profile', userId] as const,
  watchlists: (userId: string) => [...USER_KEYS.all, 'watchlists', userId] as const,
}

export const TITLE_KEYS = {
  all: ['title'] as const,
  detail: (id: string | number) => [...TITLE_KEYS.all, 'detail', id] as const,
  rating: (titleId: string) => [...TITLE_KEYS.all, 'rating', titleId] as const,
  episodeRating: (titleId: string, season: number, episode: number) =>
    [...TITLE_KEYS.all, 'episodeRating', titleId, season, episode] as const,
}

export const WATCHLIST_KEYS = {
  all: ['watchlist'] as const,
  detail: (id: string) => [...WATCHLIST_KEYS.all, 'detail', id] as const,
}

// --- User Hooks ---

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: USER_KEYS.profile(userId || ''),
    queryFn: () => databaseService.getUserProfile(userId!),
    enabled: !!userId,
  })
}

export function useUserWatchlists() {
  return useQuery({
    queryKey: USER_KEYS.watchlists('me'),
    queryFn: () => databaseService.getUserWatchlists(),
  })
}

// --- Content Hooks ---

export function useWatchedMovies(userId: string | undefined) {
  return useQuery({
    queryKey: TIMELINE_KEYS.watchedMovies(userId || ''),
    queryFn: () => databaseService.getWatchedMovies(userId!),
    enabled: !!userId,
  })
}

export function useWatchedSeries(userId: string | undefined) {
  return useQuery({
    queryKey: TIMELINE_KEYS.watchedSeries(userId || ''),
    queryFn: () => databaseService.getWatchedSeries(userId!),
    enabled: !!userId,
  })
}

// --- Title Hooks ---

export function useTitleDetails(tmdbId: number) {
  return useQuery({
    queryKey: TITLE_KEYS.detail(tmdbId),
    queryFn: () => databaseService.getTitleByTmdbId(tmdbId),
    enabled: !!tmdbId,
  })
}

export function useUserTitleRating(titleId: string | undefined) {
  return useQuery({
    queryKey: TITLE_KEYS.rating(titleId || ''),
    queryFn: () => databaseService.getUserRating(titleId!),
    enabled: !!titleId,
  })
}

// --- Mutations ---

export function useRateTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      titleId,
      rating,
      watchType,
      watchedAt,
      notes,
    }: {
      titleId: string
      rating: number
      watchType: 'first-time' | 'rewatch'
      watchedAt: Date
      notes?: string
    }) => databaseService.rateTitle(titleId, rating, watchType, watchedAt, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: TITLE_KEYS.rating(variables.titleId) })
      queryClient.invalidateQueries({ queryKey: TIMELINE_KEYS.all })
    },
  })
}
