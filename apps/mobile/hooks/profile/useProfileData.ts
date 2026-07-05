// Hook for managing profile data loading and state
import { useState, useCallback, useEffect } from 'react'
import { dbService } from '~/services/database'
import type { UserProfile, WatchedMovie, WatchedSeries } from '~/types'
import { useAuth } from '@/hooks/useAuth'

export interface UseProfileDataReturn {
  profile: UserProfile | null
  watchedMovies: WatchedMovie[]
  watchedSeries: WatchedSeries[]
  loading: boolean
  refreshing: boolean
  onRefresh: () => Promise<void>
}

export function useProfileData(targetUserId: string | undefined): UseProfileDataReturn {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovie[]>([])
  const [watchedSeries, setWatchedSeries] = useState<WatchedSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    if (!targetUserId) return

    try {
      const [userProfile, movies, series] = await Promise.all([
        dbService.getUserProfile(targetUserId),
        dbService.getWatchedMovies(targetUserId),
        dbService.getWatchedSeries(targetUserId),
      ])

      setProfile(userProfile)
      setWatchedMovies(movies as WatchedMovie[])
      setWatchedSeries(series as WatchedSeries[])
    } catch (error) {
      console.error('Failed to load profile data', error)
    } finally {
      setLoading(false)
    }
  }, [targetUserId])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  // Reset loading when target user changes
  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  return {
    profile,
    watchedMovies,
    watchedSeries,
    loading,
    refreshing,
    onRefresh,
  }
}
