import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { dbService } from '~/services/database'
import {
  selectMobileProfilePageState,
  selectMobileProfileSliceState,
} from './profileProgressiveState'
import {
  profileIdentityQueryOptions,
  profileRelationshipQueryOptions,
  profileWatchedMoviesQueryOptions,
  profileWatchedSeriesQueryOptions,
} from './profileQueryOptions'
import { createProfileRefreshActions } from './profileRefreshActions'

export function useProfileSections(profileId: string | undefined, viewerId?: string) {
  const canonicalProfileId = profileId?.trim() || 'pending'
  const canonicalViewerId = viewerId?.trim()
  const enabled = canonicalProfileId !== 'pending'
  const visibilityScope = canonicalViewerId
    ? ({ kind: 'authenticated', userId: canonicalViewerId } as const)
    : ({ kind: 'public' } as const)
  const common = {
    profileId: canonicalProfileId,
    service: dbService,
    visibilityScope,
  }
  const identity = useQuery({ ...profileIdentityQueryOptions(common), enabled })
  const relationshipOptions = profileRelationshipQueryOptions({
    profileId: canonicalProfileId,
    service: dbService,
    viewerId: canonicalViewerId,
  })
  const relationship = useQuery({
    ...relationshipOptions,
    enabled: enabled && relationshipOptions.enabled,
  })
  const watchedMovies = useQuery({ ...profileWatchedMoviesQueryOptions(common), enabled })
  const watchedSeries = useQuery({ ...profileWatchedSeriesQueryOptions(common), enabled })
  const refetchIdentity = identity.refetch
  const refetchRelationship = relationship.refetch
  const refetchWatchedMovies = watchedMovies.refetch
  const refetchWatchedSeries = watchedSeries.refetch

  const refreshActions = useMemo(
    () =>
      createProfileRefreshActions({
        identity: refetchIdentity,
        relationship: refetchRelationship,
        watchedMovies: refetchWatchedMovies,
        watchedSeries: refetchWatchedSeries,
      }),
    [refetchIdentity, refetchRelationship, refetchWatchedMovies, refetchWatchedSeries]
  )

  const snapshot = <T>(query: {
    data: T | undefined
    error: Error | null
    fetchStatus: 'fetching' | 'idle' | 'paused'
    status: 'error' | 'pending' | 'success'
  }) => ({
    data: query.data,
    dataOwnerId: query.data === undefined ? undefined : canonicalProfileId,
    error: query.error,
    fetchStatus: query.fetchStatus,
    status: query.status,
  })

  return {
    identity,
    relationship,
    watchedMovies,
    watchedSeries,
    pageState: selectMobileProfilePageState(snapshot(identity), canonicalProfileId),
    relationshipState: selectMobileProfileSliceState(snapshot(relationship), canonicalProfileId),
    watchedMoviesState: selectMobileProfileSliceState(snapshot(watchedMovies), canonicalProfileId),
    watchedSeriesState: selectMobileProfileSliceState(snapshot(watchedSeries), canonicalProfileId),
    refreshing:
      identity.isRefetching ||
      relationship.isRefetching ||
      watchedMovies.isRefetching ||
      watchedSeries.isRefetching,
    onRefresh: enabled ? refreshActions.refreshAll : async () => {},
    retryWatchedMovies: refreshActions.retryWatchedMovies,
    retryWatchedSeries: refreshActions.retryWatchedSeries,
  }
}
