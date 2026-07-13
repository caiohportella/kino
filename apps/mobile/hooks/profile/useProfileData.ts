// Hook for managing profile data loading and state
import { useState, useCallback, useEffect } from 'react'
import { dbService } from '~/services/database'
import type { UserProfile, WatchedMovie, WatchedSeries } from '~/types'
import { useAuth } from '@/hooks/useAuth'
import { applyReleasedSeriesProgress, isFutureDateOnly } from '@kino/core'
import { getTMDbService } from '~/services/tmdb'

async function refreshSeriesAvailability(series: WatchedSeries[]) {
  const tmdb = getTMDbService()

  return Promise.all(
    series.map(async (item) => {
      const metadataSeasons = (item.seasons_metadata || []).filter(
        (season) =>
          season.season_number > 0 &&
          season.episode_count > 0
      )
      if (metadataSeasons.length === 0) return item

      const seasons = metadataSeasons.filter(
        (season) => !isFutureDateOnly(season.air_date)
      )
      if (seasons.length === 0) return applyReleasedSeriesProgress(item, [])

      const results = await Promise.all(
        seasons.map((season) =>
          tmdb.getSeasonDetails(item.tmdb_id, season.season_number).catch(() => null)
        )
      )
      if (results.some((season) => season === null)) return item
      const loadedSeasons = results.filter((season) => season !== null)

      return applyReleasedSeriesProgress(
        item,
        loadedSeasons.flatMap((season) => season.episodes)
      )
    })
  )
}

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
      setWatchedSeries(await refreshSeriesAvailability(series as WatchedSeries[]))
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
