import type { KinoDatabaseService } from '@kino/core'
import { profileCachePolicies, profileQueryKeys } from '@kino/core/cache'

type VisibilityScope = { kind: 'public' } | { kind: 'authenticated'; userId: string }

export type ProfileQueryService = Pick<
  KinoDatabaseService,
  | 'getAverageSeasonRatingsForTitles'
  | 'getFollowCounts'
  | 'getFollowRelationship'
  | 'getProfileReviews'
  | 'getPublicProfileStatsByUsername'
  | 'getPublicWatchlists'
  | 'getUserProfile'
  | 'getUserProfileByUsername'
  | 'getWatchedMovies'
  | 'getWatchedSeries'
>

function retainSameProfileOwner<T>(input: { profileId: string; visibilityScope: VisibilityScope }) {
  return {
    placeholderData: (
      previousData: T | undefined,
      previousQuery: { queryKey: readonly unknown[] } | undefined
    ) => {
      const previousKey = previousQuery?.queryKey
      if (previousKey?.[3] !== input.profileId || previousKey[4] !== input.visibilityScope.kind) {
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

export function profileUsernameResolutionQueryOptions(input: {
  service: ProfileQueryService
  username: string
}) {
  const username = input.username.trim().toLowerCase()
  return {
    queryKey: profileQueryKeys.usernameResolution(username),
    queryFn: () => input.service.getUserProfileByUsername(username),
    ...profileCachePolicies.usernameResolution,
  }
}

export function profileIdentityQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return {
    queryKey: profileQueryKeys.identity(input),
    queryFn: () => input.service.getUserProfile(input.profileId),
    ...profileCachePolicies.identity,
    ...retainSameProfileOwner<Awaited<ReturnType<ProfileQueryService['getUserProfile']>>>(input),
  }
}

export function profileRelationshipQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  viewerId?: string
}) {
  return {
    queryKey: profileQueryKeys.relationship({
      profileId: input.profileId,
      viewerId: input.viewerId ?? 'anonymous',
    }),
    queryFn: () => input.service.getFollowRelationship(input.profileId),
    enabled: Boolean(input.viewerId),
    ...profileCachePolicies.relationship,
    placeholderData: (
      previousData: Awaited<ReturnType<ProfileQueryService['getFollowRelationship']>> | undefined,
      previousQuery: { queryKey: readonly unknown[] } | undefined
    ) =>
      previousQuery?.queryKey[3] === input.profileId &&
      previousQuery.queryKey[4] === (input.viewerId ?? 'anonymous')
        ? previousData
        : undefined,
  }
}

function sectionOptions<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  policy: object,
  owner: { profileId: string; visibilityScope: VisibilityScope }
) {
  return { queryKey, queryFn, ...policy, ...retainSameProfileOwner<T>(owner) }
}

export function profileWatchedMoviesQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.watchedMovies(input),
    () => input.service.getWatchedMovies(input.profileId),
    profileCachePolicies.watchedMovies,
    input
  )
}

export function profileWatchedSeriesQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.watchedSeries(input),
    () => input.service.getWatchedSeries(input.profileId),
    profileCachePolicies.watchedSeries,
    input
  )
}

export function profileWatchlistsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.watchlists(input),
    () => input.service.getPublicWatchlists(input.profileId),
    profileCachePolicies.watchlists,
    input
  )
}

export function profileReviewsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  username: string
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.reviews(input),
    () => input.service.getProfileReviews(input.username, { limit: 6 }),
    profileCachePolicies.reviews,
    input
  )
}

export function profileRatingsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  titleIds: readonly string[]
  visibilityScope: VisibilityScope
}) {
  const titleIds = [...input.titleIds].sort()
  return sectionOptions(
    profileQueryKeys.ratings({
      profileId: input.profileId,
      visibilityScope: input.visibilityScope,
      filters: { titleIds },
    }),
    () => input.service.getAverageSeasonRatingsForTitles(input.profileId, titleIds),
    profileCachePolicies.ratings,
    input
  )
}

export function profileStatisticsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  username: string
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.statistics(input),
    async () => {
      const [publicStats, counts] = await Promise.all([
        input.service.getPublicProfileStatsByUsername(input.username),
        input.service.getFollowCounts(input.profileId),
      ])
      return { publicStats, counts }
    },
    profileCachePolicies.statistics,
    input
  )
}
