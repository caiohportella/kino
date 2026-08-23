'use client'

import { useQuery } from '@tanstack/react-query'
import type { ProfileQueryService } from '@/lib/profile/profile-query-options'
import {
  profileDiaryEntriesQueryOptions,
  profileGenreStatisticsQueryOptions,
  profileLifetimeRecapQueryOptions,
  profileMediaStatisticsQueryOptions,
  profileMonthlyRecapQueryOptions,
  profileRatingStatisticsQueryOptions,
  profileStatsQueryOptions,
  profileViewingBreakdownStatisticsQueryOptions,
  profileWatchedSeriesQueryOptions,
} from '@/lib/profile/profile-stats-query'

export function useProfileStats(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
      }
    | undefined
) {
  const options = profileStatsQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
    }
  )

  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileDiaryEntries(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
        limit?: number
      }
    | undefined
) {
  const options = profileDiaryEntriesQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
      limit: undefined,
    }
  )

  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileGenreStats(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
        limit?: number
      }
    | undefined
) {
  const options = profileGenreStatisticsQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
      limit: 5,
    }
  )
  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileRatingStats(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
      }
    | undefined
) {
  const options = profileRatingStatisticsQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
    }
  )
  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileMediaStats(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
      }
    | undefined
) {
  const options = profileMediaStatisticsQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
    }
  )
  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileViewingBreakdownStats(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
      }
    | undefined
) {
  const options = profileViewingBreakdownStatisticsQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
    }
  )
  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileWatchedSeries(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
      }
    | undefined
) {
  const options = profileWatchedSeriesQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
    }
  )
  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileLifetimeRecap(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
      }
    | undefined
) {
  const options = profileLifetimeRecapQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
    }
  )

  return useQuery({ ...options, enabled: Boolean(input) })
}

export function useProfileMonthlyRecap(
  input:
    | {
        profileId: string
        service: ProfileQueryService
        visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
        year: number
        month: number
      }
    | undefined
) {
  const options = profileMonthlyRecapQueryOptions(
    input ?? {
      profileId: 'pending',
      service: pendingService,
      visibilityScope: { kind: 'public' },
      year: 1970,
      month: 1,
    }
  )
  return useQuery({ ...options, enabled: Boolean(input) })
}

const pendingService = new Proxy(
  {},
  {
    get() {
      return async () => {
        throw new Error('Disabled profile stats query executed.')
      }
    },
  }
) as ProfileQueryService
