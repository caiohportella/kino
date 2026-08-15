import {
  type ProfileQueryService,
  profileDiaryEntriesQueryOptions,
  profileGenreStatisticsQueryOptions,
  profileLifetimeStatisticsQueryOptions,
  profileMediaStatisticsQueryOptions,
  profileMonthlyRecapQueryOptions,
  profileRatingStatisticsQueryOptions,
  profileViewingBreakdownStatisticsQueryOptions,
  profileWatchedSeriesQueryOptions,
} from './profile-query-options.ts'

export function profileStatsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: { kind: 'public' } | { kind: 'authenticated'; userId: string }
}) {
  return profileLifetimeStatisticsQueryOptions(input)
}

export {
  profileDiaryEntriesQueryOptions,
  profileGenreStatisticsQueryOptions,
  profileMediaStatisticsQueryOptions,
  profileMonthlyRecapQueryOptions,
  profileRatingStatisticsQueryOptions,
  profileViewingBreakdownStatisticsQueryOptions,
  profileWatchedSeriesQueryOptions,
}
