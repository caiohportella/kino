import { profileCachePolicies, profileQueryKeys } from '@kino/core/cache'
import type { UserProfile } from '~/types'
import type { WatchedMovie, WatchedSeries } from '~/types/supabase'

type VisibilityScope = { kind: 'public' } | { kind: 'authenticated'; userId: string }

export interface MobileProfileQueryService {
  checkFollowStatus(profileId: string): Promise<boolean>
  getFollowCounts(profileId: string): Promise<{ followers: number; following: number }>
  getUserProfile(profileId: string): Promise<UserProfile | null>
  getWatchedMovies(profileId: string): Promise<WatchedMovie[]>
  getWatchedSeries(profileId: string): Promise<WatchedSeries[]>
}

export interface MobileProfileRelationship {
  counts: { followers: number; following: number }
  isFollowing: boolean
}

type OwnerInput = {
  profileId: string
  visibilityScope: VisibilityScope
}

function retainSameProfileOwner<T>(input: OwnerInput) {
  return {
    placeholderData: (
      previousData: T | undefined,
      previousQuery: { queryKey: readonly unknown[] } | undefined
    ) => {
      const previousKey = previousQuery?.queryKey
      if (
        previousKey?.[3] !== input.profileId.trim() ||
        previousKey[4] !== input.visibilityScope.kind
      ) {
        return undefined
      }
      if (
        input.visibilityScope.kind === 'authenticated' &&
        previousKey[5] !== input.visibilityScope.userId
      ) {
        return undefined
      }
      return previousData
    },
  }
}

export function profileIdentityQueryOptions(
  input: OwnerInput & { service: MobileProfileQueryService }
) {
  return {
    queryKey: profileQueryKeys.identity(input),
    queryFn: () => input.service.getUserProfile(input.profileId),
    ...profileCachePolicies.identity,
    ...retainSameProfileOwner<Awaited<ReturnType<MobileProfileQueryService['getUserProfile']>>>(
      input
    ),
  }
}

export function profileRelationshipQueryOptions(input: {
  profileId: string
  service: MobileProfileQueryService
  viewerId?: string
}) {
  const profileId = input.profileId.trim()
  const viewerId = input.viewerId?.trim()
  return {
    queryKey: profileQueryKeys.relationship({
      profileId,
      viewerId: viewerId || 'anonymous',
    }),
    queryFn: async () => {
      const [counts, isFollowing] = await Promise.all([
        input.service.getFollowCounts(profileId),
        !viewerId || viewerId === profileId
          ? Promise.resolve(false)
          : input.service.checkFollowStatus(profileId),
      ])
      return { counts, isFollowing }
    },
    enabled: true,
    ...profileCachePolicies.relationship,
    placeholderData: (
      previousData: MobileProfileRelationship | undefined,
      previousQuery: { queryKey: readonly unknown[] } | undefined
    ) =>
      previousQuery?.queryKey[3] === profileId &&
      previousQuery.queryKey[4] === (viewerId || 'anonymous')
        ? previousData
        : undefined,
  }
}

function sectionOptions<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  policy: { gcTime: number; staleTime: number },
  owner: OwnerInput
) {
  return { queryKey, queryFn, ...policy, ...retainSameProfileOwner<T>(owner) }
}

export function profileWatchedMoviesQueryOptions(
  input: OwnerInput & { service: MobileProfileQueryService }
) {
  return sectionOptions(
    profileQueryKeys.watchedMovies(input),
    () => input.service.getWatchedMovies(input.profileId),
    profileCachePolicies.watchedMovies,
    input
  )
}

export function profileWatchedSeriesQueryOptions(
  input: OwnerInput & { service: MobileProfileQueryService }
) {
  return sectionOptions(
    profileQueryKeys.watchedSeries(input),
    () => input.service.getWatchedSeries(input.profileId),
    profileCachePolicies.watchedSeries,
    input
  )
}
