import assert from 'node:assert/strict'
import test from 'node:test'
import { createProfileQueryService } from '../../profile/profile-query-service.ts'

test('adapts legacy username-only profile providers behind canonical profile-id methods', async () => {
  const calls = []
  const database = {
    getUserProfile: async (profileId) => {
      calls.push(['profile', profileId])
      return { id: profileId, username: 'Ada' }
    },
    getProfileReviews: async (username, options) => {
      calls.push(['reviews', username, options])
      return { items: [], nextCursor: null, totalCount: 2 }
    },
    getProfileGenreStatsByProfileId: async () => [],
    getProfileMediaStatsByProfileId: async () => ({
      seriesWatched: 4,
      movieRatings: { average: 3.5, ratedCount: 2 },
      seriesRatings: { average: 4.1, ratedCount: 1 },
    }),
    getProfileViewingBreakdownStatsByProfileId: async () => ({
      movieTimeWatchedMinutes: 120,
      tvTimeWatchedMinutes: 240,
      longestMovieStreakDays: 3,
      longestSeriesStreakDays: 2,
      studioStats: [],
    }),
    getPublicProfileStatsByUsername: async (username) => {
      calls.push(['statistics', username])
      return { diaryEntries: 1, moviesWatched: 2, reviews: 3, seriesWatched: 4 }
    },
    getProfileMonthlyRecapByProfileId: async () => ({
      activeDays: 0,
      episodesWatched: 0,
      month: 1,
      moviesWatched: 0,
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
      topGenres: [],
      topTitles: [],
      year: 2026,
    }),
    getProfileRatingStatsByProfileId: async () => ({
      averageRating: null,
      distribution: [],
      totalRatings: 0,
    }),
  }
  const service = createProfileQueryService(database)

  assert.equal(
    (await service.getProfileReviewsByProfileId('profile-a', { limit: 6 })).totalCount,
    2
  )
  assert.equal((await service.getPublicProfileStatsByProfileId('profile-a')).reviews, 3)
  assert.deepEqual(calls, [
    ['profile', 'profile-a'],
    ['reviews', 'Ada', { limit: 6 }],
    ['profile', 'profile-a'],
    ['statistics', 'Ada'],
  ])
})

test('returns empty canonical slices when the profile has no legacy username', async () => {
  const database = {
    getUserProfile: async () => ({ id: 'profile-a', username: null }),
    getProfileReviews: async () => {
      throw new Error('must not call username provider')
    },
    getProfileGenreStatsByProfileId: async () => [],
    getProfileMediaStatsByProfileId: async () => ({
      seriesWatched: 0,
      movieRatings: { average: null, ratedCount: 0 },
      seriesRatings: { average: null, ratedCount: 0 },
    }),
    getProfileViewingBreakdownStatsByProfileId: async () => ({
      movieTimeWatchedMinutes: 0,
      tvTimeWatchedMinutes: 0,
      longestMovieStreakDays: 0,
      longestSeriesStreakDays: 0,
      studioStats: [],
    }),
    getPublicProfileStatsByUsername: async () => {
      throw new Error('must not call username provider')
    },
    getProfileMonthlyRecapByProfileId: async () => {
      throw new Error('must not call username provider')
    },
    getProfileRatingStatsByProfileId: async () => ({
      averageRating: null,
      distribution: [],
      totalRatings: 0,
    }),
  }
  const service = createProfileQueryService(database)

  assert.deepEqual(await service.getProfileReviewsByProfileId('profile-a', { limit: 6 }), {
    items: [],
    nextCursor: null,
    totalCount: 0,
  })
  assert.equal(await service.getPublicProfileStatsByProfileId('profile-a'), null)
})

test('applies released episode availability before exposing watched series progress', async () => {
  const database = {
    getWatchedSeries: async () => [
      {
        id: 'series-1',
        tmdb_id: 1,
        type: 'tv',
        title: 'Series',
        synopsis: null,
        cover_image: null,
        backdrop_image: null,
        release_year: 2020,
        genres: [],
        cast: [],
        total_episodes: 2,
        watched_episode_count: 1,
        latest_rating: null,
        latest_watched_at: '2026-07-01T00:00:00.000Z',
        last_episode: { season: 1, episode: 1 },
        next_episode: { season: 1, episode: 2, air_date: '2026-07-13' },
        is_series_completed: false,
        watched_episode_keys: ['1-1'],
      },
    ],
  }
  const service = createProfileQueryService(database, {
    getEpisodeAvailability: async () => [
      { season_number: 1, episode_number: 1, air_date: '2026-07-01' },
      { season_number: 1, episode_number: 2, air_date: '2027-01-01' },
    ],
  })

  const [series] = await service.getWatchedSeries('profile-a')
  assert.equal(series.next_episode, null)
  assert.equal(series.is_caught_up, true)
  assert.equal(series.total_episodes, 1)
})

test('delegates lifetime stats to the underlying database service', async () => {
  let calls = 0

  const expected = {
    moviesWatched: 10,
    episodesWatched: 20,
    ratingsMade: 5,
    timeWatchedMinutes: 300,
  }

  const database = {
    async getProfileLifetimeStatsByProfileId(profileId) {
      calls += 1
      assert.equal(profileId, 'user-1')
      return expected
    },
    async getProfileGenreStatsByProfileId() {
      return []
    },
    async getProfileMediaStatsByProfileId() {
      return {
        seriesWatched: 12,
        movieRatings: { average: 3.7, ratedCount: 4 },
        seriesRatings: { average: 4.2, ratedCount: 3 },
      }
    },
    async getProfileViewingBreakdownStatsByProfileId() {
      return {
        movieTimeWatchedMinutes: 120,
        tvTimeWatchedMinutes: 240,
        longestMovieStreakDays: 3,
        longestSeriesStreakDays: 2,
        studioStats: [{ name: 'Studio One', count: 1, percentage: 100 }],
      }
    },
    async getProfileRatingStatsByProfileId() {
      return { averageRating: null, distribution: [], totalRatings: 0 }
    },
    async getProfileMonthlyRecapByProfileId() {
      return {
        activeDays: 0,
        episodesWatched: 0,
        month: 1,
        moviesWatched: 0,
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
        topGenres: [],
        topTitles: [],
        year: 2026,
      }
    },
  }

  const service = createProfileQueryService(database)

  const result = await service.getProfileLifetimeStatsByProfileId('user-1')

  assert.deepEqual(result, expected)
  assert.equal(calls, 1)
})

test('delegates lifetime recap to the dedicated database method', async () => {
  let calledWith = null

  const database = {
    getUserProfile: async () => ({ id: 'profile-1', username: 'caio' }),
    getProfileReviews: async () => ({ items: [], nextCursor: null, totalCount: 0 }),
    getPublicProfileStatsByUsername: async () => null,
    getProfileLifetimeStatsByProfileId: async () => ({
      moviesWatched: 0,
      episodesWatched: 0,
      ratingsMade: 0,
      timeWatchedMinutes: 0,
    }),
    getProfileLifetimeRecapByProfileId: async (profileId) => {
      calledWith = profileId
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
    },
  }
  const service = createProfileQueryService(database)

  await service.getProfileLifetimeRecapByProfileId('profile-1')

  assert.equal(calledWith, 'profile-1')
})

test('returns an empty lifetime recap when the legacy database lacks the dedicated method', async () => {
  const service = createProfileQueryService({
    getUserProfile: async () => ({ id: 'profile-1', username: 'caio' }),
    getProfileReviews: async () => ({ items: [], nextCursor: null, totalCount: 0 }),
    getPublicProfileStatsByUsername: async () => null,
    getProfileLifetimeStatsByProfileId: async () => ({
      moviesWatched: 0,
      episodesWatched: 0,
      ratingsMade: 0,
      timeWatchedMinutes: 0,
    }),
  })

  assert.deepEqual(await service.getProfileLifetimeRecapByProfileId('profile-1'), {
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
  })
})

test('delegates media stats to the underlying database service without recursion', async () => {
  let calls = 0

  const expected = {
    seriesWatched: 12,
    movieRatings: { average: 3.7, ratedCount: 4 },
    seriesRatings: { average: 4.2, ratedCount: 3 },
  }

  const database = {
    async getProfileMediaStatsByProfileId(profileId) {
      calls += 1
      assert.equal(profileId, 'user-1')
      return expected
    },
    async getProfileLifetimeStatsByProfileId() {
      return {
        moviesWatched: 0,
        episodesWatched: 0,
        ratingsMade: 0,
        timeWatchedMinutes: 0,
      }
    },
    async getProfileGenreStatsByProfileId() {
      return []
    },
    async getProfileRatingStatsByProfileId() {
      return { averageRating: null, distribution: [], totalRatings: 0 }
    },
    async getProfileMonthlyRecapByProfileId() {
      return {
        activeDays: 0,
        episodesWatched: 0,
        month: 1,
        moviesWatched: 0,
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
        topGenres: [],
        topTitles: [],
        year: 2026,
      }
    },
  }

  const service = createProfileQueryService(database)

  const result = await service.getProfileMediaStatsByProfileId('user-1')

  assert.deepEqual(result, expected)
  assert.equal(calls, 1)
})

test('delegates viewing breakdown stats to the underlying database service without recursion', async () => {
  let calls = 0

  const expected = {
    movieTimeWatchedMinutes: 120,
    tvTimeWatchedMinutes: 240,
    longestMovieStreakDays: 3,
    longestSeriesStreakDays: 2,
    studioStats: [{ name: 'Studio One', count: 1, percentage: 100 }],
  }

  const database = {
    async getProfileViewingBreakdownStatsByProfileId(profileId) {
      calls += 1
      assert.equal(profileId, 'user-1')
      return expected
    },
    async getProfileMediaStatsByProfileId() {
      return {
        seriesWatched: 12,
        movieRatings: { average: 3.7, ratedCount: 4 },
        seriesRatings: { average: 4.2, ratedCount: 3 },
      }
    },
    async getProfileLifetimeStatsByProfileId() {
      return {
        moviesWatched: 0,
        episodesWatched: 0,
        ratingsMade: 0,
        timeWatchedMinutes: 0,
      }
    },
    async getProfileGenreStatsByProfileId() {
      return []
    },
    async getProfileRatingStatsByProfileId() {
      return { averageRating: null, distribution: [], totalRatings: 0 }
    },
    async getProfileMonthlyRecapByProfileId() {
      return {
        activeDays: 0,
        episodesWatched: 0,
        month: 1,
        moviesWatched: 0,
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
        topGenres: [],
        topTitles: [],
        year: 2026,
      }
    },
  }

  const service = createProfileQueryService(database)

  const result = await service.getProfileViewingBreakdownStatsByProfileId('user-1')

  assert.deepEqual(result, expected)
  assert.equal(calls, 1)
})
