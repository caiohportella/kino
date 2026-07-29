import { profileCachePolicies, profileQueryKeys } from '@kino/core/cache'
import { keepPreviousData } from '@tanstack/react-query'

type VisibilityScope = { kind: 'public' } | { kind: 'authenticated'; userId: string }

export interface ProfileQueryService {
  getUserProfileByUsername(username: string): Promise<unknown>
  getUserProfile(profileId: string): Promise<unknown>
  getFollowRelationship(viewerId: string, profileId: string): Promise<unknown>
  getFollowCounts(profileId: string): Promise<unknown>
  getWatchedMovies(profileId: string): Promise<unknown>
  getWatchedSeries(profileId: string): Promise<unknown>
  getPublicProfileStatsByUsername(username: string): Promise<unknown>
  getPublicWatchlists(profileId: string): Promise<unknown>
  getProfileReviews(username: string, options?: { limit?: number }): Promise<unknown>
  getAverageSeasonRatingsForTitles(profileId: string, titleIds: readonly string[]): Promise<unknown>
}

const retained = { placeholderData: keepPreviousData }

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
    ...retained,
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
    queryFn: () => input.service.getFollowRelationship(input.viewerId!, input.profileId),
    enabled: Boolean(input.viewerId),
    ...profileCachePolicies.relationship,
    ...retained,
  }
}

function sectionOptions<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>, policy: object) {
  return { queryKey, queryFn, ...policy, ...retained }
}

export function profileWatchedMoviesQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.watchedMovies(input),
    () => input.service.getWatchedMovies(input.profileId),
    profileCachePolicies.watchedMovies
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
    profileCachePolicies.watchedSeries
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
    profileCachePolicies.watchlists
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
    profileCachePolicies.reviews
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
    profileCachePolicies.ratings
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
    profileCachePolicies.statistics
  )
}
