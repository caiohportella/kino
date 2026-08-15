import type {
  ProfileGenreStat,
  ProfileLifetimeRecap,
  ProfileLifetimeStats,
  ProfileMediaStats,
  ProfileMonthlyRecap,
  ProfileRatingStats,
  ProfileReviewOptions,
  ProfileReviewsPage,
  ProfileViewingBreakdownStats,
  UIDiaryEntry,
  UserProfile,
  WatchedSeries,
} from '@kino/core'
import { applyReleasedSeriesProgress, type EpisodeAvailability } from '@kino/core'
import type { ProfileQueryService, PublicProfileStats } from './profile-query-options'

interface LegacyProfileDatabase {
  getProfileReviews(username: string, options?: ProfileReviewOptions): Promise<ProfileReviewsPage>

  getProfileLifetimeStatsByProfileId?(profileId: string): Promise<ProfileLifetimeStats>

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

  getDiaryEntries?(profileId: string, limit?: number): Promise<UIDiaryEntry[]>

  getPublicProfileStatsByUsername(username: string): Promise<PublicProfileStats | null>

  getUserProfile(profileId: string): Promise<UserProfile | null>
}

type CanonicalProfileMethods = Pick<
  ProfileQueryService,
  | 'getProfileReviewsByProfileId'
  | 'getProfileGenreStatsByProfileId'
  | 'getProfileMediaStatsByProfileId'
  | 'getProfileViewingBreakdownStatsByProfileId'
  | 'getPublicProfileStatsByProfileId'
  | 'getProfileLifetimeStatsByProfileId'
  | 'getProfileLifetimeRecapByProfileId'
  | 'getProfileMonthlyRecapByProfileId'
  | 'getProfileRatingStatsByProfileId'
  | 'getDiaryEntries'
>

export function createProfileQueryService<T extends LegacyProfileDatabase>(
  database: T,
  options?: {
    getEpisodeAvailability?: (series: WatchedSeries) => Promise<EpisodeAvailability[]>
  }
): T & CanonicalProfileMethods {
  // Capture the original methods BEFORE Object.assign mutates `database`.
  const getProfileLifetimeStatsByProfileId =
    database.getProfileLifetimeStatsByProfileId?.bind(database)

  const getProfileLifetimeRecapByProfileId =
    database.getProfileLifetimeRecapByProfileId?.bind(database)

  const getProfileGenreStatsByProfileId = database.getProfileGenreStatsByProfileId?.bind(database)

  const getProfileMediaStatsByProfileId = database.getProfileMediaStatsByProfileId?.bind(database)

  const getProfileViewingBreakdownStatsByProfileId =
    database.getProfileViewingBreakdownStatsByProfileId?.bind(database)

  const getProfileRatingStatsByProfileId = database.getProfileRatingStatsByProfileId?.bind(database)

  const getProfileMonthlyRecapByProfileId =
    database.getProfileMonthlyRecapByProfileId?.bind(database)

  const getDiaryEntries = database.getDiaryEntries?.bind(database)

  const service = Object.assign(database, {
    async getProfileReviewsByProfileId(profileId: string, options?: ProfileReviewOptions) {
      const profile = await database.getUserProfile(profileId)

      if (!profile?.username) {
        return {
          items: [],
          nextCursor: null,
          totalCount: 0,
        }
      }

      return database.getProfileReviews(profile.username, options)
    },

    async getPublicProfileStatsByProfileId(profileId: string) {
      const profile = await database.getUserProfile(profileId)

      if (!profile?.username) return null

      return database.getPublicProfileStatsByUsername(profile.username)
    },

    async getProfileLifetimeStatsByProfileId(profileId: string): Promise<ProfileLifetimeStats> {
      if (!getProfileLifetimeStatsByProfileId) {
        return {
          moviesWatched: 0,
          episodesWatched: 0,
          ratingsMade: 0,
          timeWatchedMinutes: 0,
        }
      }

      return getProfileLifetimeStatsByProfileId(profileId)
    },

    async getProfileLifetimeRecapByProfileId(profileId: string): Promise<ProfileLifetimeRecap> {
      if (!getProfileLifetimeRecapByProfileId) {
        return {
          moviesWatched: 0,
          episodesWatched: 0,
          ratingsMade: 0,
          timeWatchedMinutes: 0,
          topRatedMovies: [],
          topRatedSeries: [],
          topGenres: [],
          mostRatedGenre: null,
          highestRatedStudio: null,
          highestRatedActor: null,
          highestRatedActress: null,
          highestRatedGenre: null,
          highestRatedDecade: null,
        }
      }

      return getProfileLifetimeRecapByProfileId(profileId)
    },

    async getProfileGenreStatsByProfileId(
      profileId: string,
      limit = 5
    ): Promise<ProfileGenreStat[]> {
      if (!getProfileGenreStatsByProfileId) {
        return []
      }

      return getProfileGenreStatsByProfileId(profileId, limit)
    },

    async getProfileMediaStatsByProfileId(profileId: string): Promise<ProfileMediaStats> {
      if (!getProfileMediaStatsByProfileId) {
        return {
          seriesWatched: 0,
          movieRatings: { average: null, ratedCount: 0 },
          seriesRatings: { average: null, ratedCount: 0 },
        }
      }

      return getProfileMediaStatsByProfileId(profileId)
    },

    async getProfileViewingBreakdownStatsByProfileId(
      profileId: string
    ): Promise<ProfileViewingBreakdownStats> {
      if (!getProfileViewingBreakdownStatsByProfileId) {
        return {
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
        }
      }

      return getProfileViewingBreakdownStatsByProfileId(profileId)
    },

    async getProfileRatingStatsByProfileId(profileId: string): Promise<ProfileRatingStats> {
      if (!getProfileRatingStatsByProfileId) {
        return {
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
        }
      }

      return getProfileRatingStatsByProfileId(profileId)
    },

    async getProfileMonthlyRecapByProfileId(
      profileId: string,
      year: number,
      month: number
    ): Promise<ProfileMonthlyRecap> {
      if (!getProfileMonthlyRecapByProfileId) {
        return {
          activeDays: 0,
          episodesWatched: 0,
          month,
          moviesWatched: 0,
          uniqueTitlesWatched: 0,
          averageRating: null,
          dailyActivity: [],
          highestRated: null,
          lowestRated: null,
          topRatedMovies: [],
          topRatedSeries: [],
          topTitles: [],
          topGenres: [],
          mostWatchedSeries: [],
          finishedSeries: [],
          mostWatchedStudio: null,
          topActor: null,
          highestRatedStudio: null,
          highestRatedActor: null,
          highestRatedActress: null,
          highestRatedGenre: null,
          highestRatedDecade: null,
          previousMonthComparison: {
            episodesDelta: 0,
            moviesDelta: 0,
            ratingsDelta: 0,
            timeWatchedMinutesDelta: 0,
          },
          ratingsMade: 0,
          rewatches: 0,
          timeWatchedMinutes: 0,
          year,
        } satisfies ProfileMonthlyRecap
      }

      return getProfileMonthlyRecapByProfileId(profileId, year, month)
    },

    async getDiaryEntries(profileId: string, limit?: number): Promise<UIDiaryEntry[]> {
      if (!getDiaryEntries) return []
      return getDiaryEntries(profileId, limit)
    },
  })

  if (options?.getEpisodeAvailability && 'getWatchedSeries' in database) {
    const getWatchedSeries = (
      database as T & {
        getWatchedSeries: (profileId: string) => Promise<WatchedSeries[]>
      }
    ).getWatchedSeries.bind(database)

    Object.assign(service, {
      async getWatchedSeries(profileId: string) {
        const series = await getWatchedSeries(profileId)

        return Promise.all(
          series.map(async (item) => {
            try {
              const episodes = await options.getEpisodeAvailability?.(item)

              return episodes ? applyReleasedSeriesProgress(item, episodes) : item
            } catch {
              return item
            }
          })
        )
      },
    })
  }

  return service
}
