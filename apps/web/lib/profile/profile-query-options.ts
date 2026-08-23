import type {
  FollowRelationship,
  MediaType,
  NextEpisodeCandidate,
  ProfileCollectionItem,
  ProfileGenreStat,
  ProfileLifetimeRecap,
  ProfileLifetimeStats,
  ProfileMediaStats,
  ProfileMonthlyRecap,
  ProfileRatingStats,
  ProfileReviewOptions,
  ProfileReviewsPage,
  ProfileViewingBreakdownStats,
  PublicWatchlistSummary,
  UIDiaryEntry,
  UserProfile,
  WatchedMovie,
  WatchedSeries,
} from '@kino/core'
import { profileCachePolicies, profileQueryKeys } from '@kino/core/cache'
import { deriveCompleteSeriesWatchPasses } from './profile-series-rewatch.ts'

type VisibilityScope = { kind: 'public' } | { kind: 'authenticated'; userId: string }

export interface ProfileQueryService {
  getAverageSeasonRatingsForTitles(
    profileId: string,
    titleIds: string[]
  ): Promise<Record<string, number>>
  getFollowCounts(profileId: string): Promise<ProfileFollowCounts>
  getFollowRelationship(profileId: string): Promise<FollowRelationship>
  getProfileReviewsByProfileId(
    profileId: string,
    options?: ProfileReviewOptions
  ): Promise<ProfileReviewsPage>
  getProfileLifetimeStatsByProfileId(profileId: string): Promise<ProfileLifetimeStats>
  getProfileLifetimeRecapByProfileId?(profileId: string): Promise<ProfileLifetimeRecap>
  getProfileGenreStatsByProfileId?(profileId: string, limit?: number): Promise<ProfileGenreStat[]>
  getProfileMediaStatsByProfileId?(profileId: string): Promise<ProfileMediaStats>
  getProfileViewingBreakdownStatsByProfileId?(
    profileId: string
  ): Promise<ProfileViewingBreakdownStats>
  getProfileRatingStatsByProfileId?(profileId: string): Promise<ProfileRatingStats>
  getProfileMonthlyRecapByProfileId?(
    profileId: string,
    year: number,
    month: number
  ): Promise<ProfileMonthlyRecap>
  getPublicWatchlists(profileId: string): Promise<PublicWatchlistSummary[]>
  getPublicProfileStatsByProfileId(profileId: string): Promise<PublicProfileStats | null>
  getUserProfile(profileId: string): Promise<UserProfile | null>
  getUserProfileByUsername(username: string): Promise<UserProfile | null>
  getWatchedMovies(profileId: string): Promise<WatchedMovie[]>
  getDiaryEntries(profileId: string, limit?: number): Promise<UIDiaryEntry[]>
  getWatchedSeries(profileId: string): Promise<ProfileWatchedSeries[]>
  getProfileCollectionItemsByProfileId(
    profileId: string,
    mediaType: MediaType
  ): Promise<ProfileCollectionItem[]>
}

export interface ProfileFollowCounts {
  followers: number
  following: number
}

export interface PublicProfileStats {
  diaryEntries: number
  moviesWatched: number
  reviews: number
  seriesWatched: number
}

export interface ProfileWatchedSeries extends WatchedSeries {
  is_series_completed: boolean
  next_episode: NextEpisodeCandidate | null
  watched_episode_keys: string[]
}

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

export function profileCollectionQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
  mediaType: MediaType
}) {
  return sectionOptions(
    profileQueryKeys.collection(input),
    async () => {
      const items = await input.service.getProfileCollectionItemsByProfileId(
        input.profileId,
        input.mediaType
      )

      if (input.mediaType !== 'tv') {
        return items
      }

      return items.map((item) => ({
        ...item,
        seriesPasses: deriveCompleteSeriesWatchPasses(
          item.requiredEpisodes ?? [],
          item.watchEvents.flatMap((event) => {
            if (event.seasonNumber === undefined || event.episodeNumber === undefined) {
              return []
            }

            return [
              {
                seasonNumber: event.seasonNumber,
                episodeNumber: event.episodeNumber,
                watchedAt: event.watchedAt,
              },
            ]
          })
        ),
      }))
    },
    profileCachePolicies.collection,
    input
  )
}

export function profileDiaryEntriesQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
  limit?: number
}) {
  return sectionOptions(
    profileQueryKeys.diaryEntries({
      profileId: input.profileId,
      visibilityScope: input.visibilityScope,
      filters: input.limit ? { limit: input.limit } : undefined,
    }),
    () => input.service.getDiaryEntries(input.profileId, input.limit),
    profileCachePolicies.diaryEntries,
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
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.reviews(input),
    () => input.service.getProfileReviewsByProfileId(input.profileId, { limit: 6 }),
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
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.statistics(input),
    async () => {
      const [publicStats, counts] = await Promise.all([
        input.service.getPublicProfileStatsByProfileId(input.profileId),
        input.service.getFollowCounts(input.profileId),
      ])
      return { publicStats, counts }
    },
    profileCachePolicies.statistics,
    input
  )
}

export function profileLifetimeStatisticsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.lifetimeStats(input),
    () => input.service.getProfileLifetimeStatsByProfileId(input.profileId),
    profileCachePolicies.lifetimeStats,
    input
  )
}

export function profileLifetimeRecapQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.lifetimeRecap(input),
    async () =>
      input.service.getProfileLifetimeRecapByProfileId?.(input.profileId) ??
      ({
        moviesWatched: 0,
        episodesWatched: 0,
        timeWatchedMinutes: 0,
        ratingsMade: 0,
        topRatedMovies: [],
        topRatedSeries: [],
        topGenres: [],
        mostRatedGenre: null,
        highestRatedStudio: null,
        highestRatedActor: null,
        highestRatedActress: null,
        highestRatedGenre: null,
        highestRatedDecade: null,
      } satisfies ProfileLifetimeRecap),
    profileCachePolicies.lifetimeStats,
    input
  )
}

export function profileGenreStatisticsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
  limit?: number
}) {
  return sectionOptions(
    profileQueryKeys.genreStats(input),
    async () => input.service.getProfileGenreStatsByProfileId?.(input.profileId) ?? [],
    profileCachePolicies.genreStats,
    input
  )
}

export function profileMediaStatisticsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.mediaStats(input),
    async () =>
      input.service.getProfileMediaStatsByProfileId?.(input.profileId) ?? {
        seriesWatched: 0,
        movieRatings: { average: null, ratedCount: 0 },
        seriesRatings: { average: null, ratedCount: 0 },
      },
    profileCachePolicies.mediaStats,
    input
  )
}

export function profileViewingBreakdownStatisticsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.viewingBreakdownStats(input),
    async () =>
      input.service.getProfileViewingBreakdownStatsByProfileId?.(input.profileId) ?? {
        movieTimeWatchedMinutes: 0,
        tvTimeWatchedMinutes: 0,
        averageMovieRuntimeMinutes: 0,
        averageEpisodesPerSeries: 0,
        longestBingeEpisodes: 0,
        longestMovieStreakDays: 0,
        longestSeriesStreakDays: 0,
        studioStats: [],
        weekdayMediaSplit: {
          movies: 0,
          series: 0,
          moviePercentage: 0,
          seriesPercentage: 0,
          dominantType: null,
        },
        weekendMediaSplit: {
          movies: 0,
          series: 0,
          moviePercentage: 0,
          seriesPercentage: 0,
          dominantType: null,
        },
      },
    profileCachePolicies.viewingBreakdownStats,
    input
  )
}

export function profileRatingStatisticsQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
}) {
  return sectionOptions(
    profileQueryKeys.ratingStats(input),
    async () =>
      input.service.getProfileRatingStatsByProfileId?.(input.profileId) ?? {
        averageRating: null,
        movieAverageRating: null,
        seriesAverageRating: null,
        distribution: [],
        totalRatings: 0,
        fiveStarRate: 0,
        mostRatedGenre: null,
        highestRatedGenre: null,
        highestRatedDecade: null,
        highestRatedStudio: null,
        highestRatedActor: null,
        highestRatedActress: null,
        highestRatedMovie: null,
        lowestRatedMovie: null,
        highestRatedSeries: null,
        lowestRatedSeries: null,
      },
    profileCachePolicies.ratingStats,
    input
  )
}

export function profileMonthlyRecapQueryOptions(input: {
  profileId: string
  service: ProfileQueryService
  visibilityScope: VisibilityScope
  year: number
  month: number
}) {
  return sectionOptions(
    profileQueryKeys.monthlyRecap(input),
    async () =>
      input.service.getProfileMonthlyRecapByProfileId?.(input.profileId, input.year, input.month) ??
      ({
        activeDays: 0,
        averageRating: null,
        dailyActivity: [],
        episodesWatched: 0,
        finishedSeries: [],
        highestRated: null,
        lowestRated: null,
        highestRatedStudio: null,
        highestRatedActor: null,
        highestRatedActress: null,
        highestRatedGenre: null,
        highestRatedDecade: null,
        month: input.month,
        moviesWatched: 0,
        mostWatchedStudio: null,
        mostWatchedSeries: [],
        previousMonthComparison: {
          episodesDelta: 0,
          moviesDelta: 0,
          ratingsDelta: 0,
          timeWatchedMinutesDelta: 0,
        },
        ratingsMade: 0,
        rewatches: 0,
        timeWatchedMinutes: 0,
        topActor: null,
        topGenres: [],
        topRatedMovies: [],
        topRatedSeries: [],
        topTitles: [],
        uniqueTitlesWatched: 0,
        year: input.year,
      } satisfies ProfileMonthlyRecap),
    profileCachePolicies.monthlyRecap,
    input
  )
}
