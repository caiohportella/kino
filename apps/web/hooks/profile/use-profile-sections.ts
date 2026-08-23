'use client'

import { useQuery } from '@tanstack/react-query'
import {
  type ProfileQueryService,
  profileCollectionQueryOptions,
  profileIdentityQueryOptions,
  profileLifetimeStatisticsQueryOptions,
  profileRatingsQueryOptions,
  profileRelationshipQueryOptions,
  profileReviewsQueryOptions,
  profileStatisticsQueryOptions,
  profileUsernameResolutionQueryOptions,
  profileWatchedMoviesQueryOptions,
  profileWatchedSeriesQueryOptions,
  profileWatchlistsQueryOptions,
} from '@/lib/profile/profile-query-options'

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

export function useProfileCollection(
  input: Parameters<typeof profileCollectionQueryOptions>[0] | undefined
) {
  const options = profileCollectionQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
      mediaType: 'movie',
    }
  )

  return useQuery({
    ...options,
    enabled: Boolean(input),
  })
}

export function useProfileSections(
  input:
    | {
        profileId: string
        viewerId?: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
      }
    | undefined
) {
  const resolvedInput = input ?? {
    profileId: 'pending',
    service: pendingService,
    visibilityScope: { kind: 'public' } as const,
  }
  const relationshipOptions = profileRelationshipQueryOptions(resolvedInput)
  const watchedMoviesOptions = profileWatchedMoviesQueryOptions(resolvedInput)
  const watchedSeriesOptions = profileWatchedSeriesQueryOptions(resolvedInput)
  const statisticsOptions = profileStatisticsQueryOptions(resolvedInput)
  const lifetimeStatisticsOptions = profileLifetimeStatisticsQueryOptions(resolvedInput)
  const watchlistsOptions = profileWatchlistsQueryOptions(resolvedInput)
  const reviewsOptions = profileReviewsQueryOptions(resolvedInput)
  const enabled = Boolean(input)

  return {
    relationship: useQuery({
      ...relationshipOptions,
      enabled: enabled && relationshipOptions.enabled,
    }),
    watchedMovies: useQuery({ ...watchedMoviesOptions, enabled }),
    watchedSeries: useQuery({ ...watchedSeriesOptions, enabled }),
    statistics: useQuery({ ...statisticsOptions, enabled }),
    lifetimeStats: useQuery({ ...lifetimeStatisticsOptions, enabled }),
    watchlists: useQuery({ ...watchlistsOptions, enabled }),
    reviews: useQuery({ ...reviewsOptions, enabled }),
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
