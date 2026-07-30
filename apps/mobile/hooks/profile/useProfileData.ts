// Temporary compatibility facade while profile consumers migrate to named query slices.
import type { UserProfile, WatchedMovie, WatchedSeries } from '~/types'
import type { MobileProfileSliceState } from './profileProgressiveState'
import type { MobileProfileRelationship } from './profileQueryOptions'
import { useProfileSections } from './useProfileSections'

export interface UseProfileDataReturn {
  profile: UserProfile | null
  watchedMovies: WatchedMovie[]
  watchedSeries: WatchedSeries[]
  loading: boolean
  error: Error | null
  refreshing: boolean
  onRefresh: () => Promise<void>
  relationship: MobileProfileRelationship | undefined
  retryWatchedMovies: () => Promise<void>
  retryWatchedSeries: () => Promise<void>
  watchedMoviesState: MobileProfileSliceState<WatchedMovie[]>
  watchedSeriesState: MobileProfileSliceState<WatchedSeries[]>
}

export function useProfileData(
  targetUserId: string | undefined,
  viewerId?: string
): UseProfileDataReturn {
  const sections = useProfileSections(targetUserId, viewerId)
  const identity = sections.pageState

  return {
    profile: identity.phase === 'ready' ? identity.identity : null,
    watchedMovies: (sections.watchedMovies.data ?? []) as WatchedMovie[],
    watchedSeries: (sections.watchedSeries.data ?? []) as WatchedSeries[],
    loading: identity.phase === 'blocking',
    error: identity.phase === 'error' ? identity.error : null,
    refreshing: sections.refreshing,
    onRefresh: sections.onRefresh,
    relationship: sections.relationship.data,
    retryWatchedMovies: sections.retryWatchedMovies,
    retryWatchedSeries: sections.retryWatchedSeries,
    watchedMoviesState: sections.watchedMoviesState as MobileProfileSliceState<WatchedMovie[]>,
    watchedSeriesState: sections.watchedSeriesState as MobileProfileSliceState<WatchedSeries[]>,
  }
}
