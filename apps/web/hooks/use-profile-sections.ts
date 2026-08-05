'use client'

import { useQuery } from '@tanstack/react-query'
import {
  type ProfileQueryService,
  profileIdentityQueryOptions,
  profileRatingsQueryOptions,
  profileRelationshipQueryOptions,
  profileReviewsQueryOptions,
  profileStatisticsQueryOptions,
  profileUsernameResolutionQueryOptions,
  profileWatchedMoviesQueryOptions,
  profileWatchedSeriesQueryOptions,
  profileWatchlistsQueryOptions,
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
    watchlists: useQuery({ ...watchlistsOptions, enabled }),
    reviews: useQuery({ ...reviewsOptions, enabled }),
  }
}

export function useProfileRatings(
  input:
    | (Parameters<typeof profileRatingsQueryOptions>[0] & { titleIds: readonly string[] })
    | undefined
) {
  const options = profileRatingsQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      titleIds: [],
      visibilityScope: { kind: 'public' },
    }
  )
  return useQuery({ ...options, enabled: Boolean(input && input.titleIds.length > 0) })
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
