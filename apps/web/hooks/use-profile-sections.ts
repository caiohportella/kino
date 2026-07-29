'use client'

import { useQuery } from '@tanstack/react-query'
import {
  profileIdentityQueryOptions,
  profileRatingsQueryOptions,
  profileRelationshipQueryOptions,
  profileReviewsQueryOptions,
  profileStatisticsQueryOptions,
  profileUsernameResolutionQueryOptions,
  profileWatchedMoviesQueryOptions,
  profileWatchedSeriesQueryOptions,
  profileWatchlistsQueryOptions,
  type ProfileQueryService,
} from '@/lib/profile-query-options'

export function useProfileUsernameResolution(
  service: ProfileQueryService,
  username: string | undefined
) {
  const options = profileUsernameResolutionQueryOptions({ service, username: username ?? '' })
  return useQuery({ ...options, enabled: Boolean(username) })
}

export function useProfileIdentity(
  input: Parameters<typeof profileIdentityQueryOptions>[0] | undefined
) {
  return useQuery({
    ...(input
      ? profileIdentityQueryOptions(input)
      : profileIdentityQueryOptions({
          profileId: 'pending',
          service: pendingService,
          visibilityScope: { kind: 'public' },
        })),
    enabled: Boolean(input),
  })
}

export function useProfileSections(input: {
  profileId: string
  username: string
  viewerId?: string
  service: ProfileQueryService
  visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
  ratingTitleIds?: readonly string[]
}) {
  return {
    relationship: useQuery(profileRelationshipQueryOptions(input)),
    watchedMovies: useQuery(profileWatchedMoviesQueryOptions(input)),
    watchedSeries: useQuery(profileWatchedSeriesQueryOptions(input)),
    statistics: useQuery(profileStatisticsQueryOptions(input)),
    watchlists: useQuery(profileWatchlistsQueryOptions(input)),
    reviews: useQuery(profileReviewsQueryOptions(input)),
    ratings: useQuery(
      profileRatingsQueryOptions({ ...input, titleIds: input.ratingTitleIds ?? [] })
    ),
  }
}

const pendingService = new Proxy(
  {},
  {
    get() {
      return async () => {
        throw new Error('Disabled profile query executed.')
      }
    },
  }
) as ProfileQueryService
