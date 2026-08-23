import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { profileQueryKeys } from '@kino/core/cache'
import * as profileQueryOptions from '../../profile/profile-query-options.ts'
import {
  profileGenreStatisticsQueryOptions,
  profileIdentityQueryOptions,
  profileLifetimeStatisticsQueryOptions,
  profileMediaStatisticsQueryOptions,
  profileMonthlyRecapQueryOptions,
  profileRatingStatisticsQueryOptions,
  profileRatingsQueryOptions,
  profileRelationshipQueryOptions,
  profileReviewsQueryOptions,
  profileStatisticsQueryOptions,
  profileUsernameResolutionQueryOptions,
  profileViewingBreakdownStatisticsQueryOptions,
  profileWatchedMoviesQueryOptions,
  profileWatchedSeriesQueryOptions,
  profileWatchlistsQueryOptions,
} from '../../profile/profile-query-options.ts'

const scope = { kind: 'authenticated', userId: 'viewer-a' }
const profileId = 'profile-a'

test('keeps the app query port structurally independent from the concrete database service', () => {
  const source = readFileSync(
    new URL('../../profile/profile-query-options.ts', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(source, /KinoDatabaseService/)
})

function createService() {
  const canonicalCalls = []
  return {
    canonicalCalls,
    getAverageSeasonRatingsForTitles: async (id, titleIds) => ({
      [id]: titleIds.length,
    }),
    getFollowCounts: async () => ({ followers: 4, following: 3 }),
    getFollowRelationship: async () => ({
      isFollowedBy: false,
      isFollowing: true,
      isMutual: false,
    }),
    getProfileReviewsByProfileId: async (id) => ({
      items: [],
      nextCursor: null,
      totalCount: id.length,
    }),
    getProfileGenreStatsByProfileId: async () => [
      { genreId: 1, name: 'Drama', count: 2, percentage: 66.7 },
    ],
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
      studioStats: [{ name: 'Studio One', count: 2, percentage: 100 }],
    }),
    getProfileLifetimeStatsByProfileId: async (id) => {
      canonicalCalls.push(['lifetime', id])
      return {
        episodesWatched: 3,
        moviesWatched: 2,
        ratingsMade: 5,
        timeWatchedMinutes: 246,
      }
    },
    getProfileLifetimeRecapByProfileId: async () => ({
      episodesWatched: 3,
      moviesWatched: 2,
      ratingsMade: 5,
      timeWatchedMinutes: 246,
      topRatedMovies: [],
      topRatedSeries: [],
      topGenres: [],
      mostRatedGenre: null,
      highestRatedStudio: null,
      highestRatedActor: null,
      highestRatedActress: null,
      highestRatedGenre: null,
      highestRatedDecade: null,
    }),
    getProfileMonthlyRecapByProfileId: async (id, year, month) => {
      canonicalCalls.push(['monthly', id, year, month])
      return {
        activeDays: 2,
        episodesWatched: 4,
        month,
        moviesWatched: 3,
        mostWatchedSeries: [],
        previousMonthComparison: {
          episodesDelta: 0,
          moviesDelta: 0,
          ratingsDelta: 0,
          timeWatchedMinutesDelta: 0,
        },
        ratingsMade: 6,
        rewatches: 1,
        timeWatchedMinutes: 120,
        topGenres: [],
        topTitles: [],
        year,
      }
    },
    getProfileRatingStatsByProfileId: async () => ({
      averageRating: 3.5,
      distribution: [],
      totalRatings: 1,
    }),
    getPublicProfileStatsByProfileId: async (id) => {
      canonicalCalls.push(['statistics', id])
      return {
        diaryEntries: 3,
        moviesWatched: 2,
        reviews: 1,
        seriesWatched: 1,
      }
    },
    getPublicWatchlists: async () => [],
    getUserProfile: async (id) => ({ id }),
    getUserProfileByUsername: async (username) => ({ id: profileId, username }),
    getWatchedMovies: async () => [],
    getWatchedSeries: async () => [],
  }
}

test('resolves usernames in a short-lived route cache before canonical profile queries begin', async () => {
  const options = profileUsernameResolutionQueryOptions({
    service: createService(),
    username: '  Ada  ',
  })

  assert.deepEqual(options.queryKey, profileQueryKeys.usernameResolution('ada'))
  assert.equal((await options.queryFn()).id, profileId)
  assert.equal(options.staleTime, 5 * 60 * 1000)
})

test('keeps identity and every content section scoped to the canonical profile id', async () => {
  const service = createService()
  const identity = profileIdentityQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })
  const movies = profileWatchedMoviesQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })
  const series = profileWatchedSeriesQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })
  const watchlists = profileWatchlistsQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })
  const reviews = profileReviewsQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })
  const ratings = profileRatingsQueryOptions({
    profileId,
    service,
    titleIds: ['series-b', 'series-a'],
    visibilityScope: scope,
  })

  assert.deepEqual(
    identity.queryKey,
    profileQueryKeys.identity({ profileId, visibilityScope: scope })
  )
  assert.deepEqual(
    movies.queryKey,
    profileQueryKeys.watchedMovies({ profileId, visibilityScope: scope })
  )
  assert.deepEqual(
    series.queryKey,
    profileQueryKeys.watchedSeries({ profileId, visibilityScope: scope })
  )
  assert.deepEqual(
    watchlists.queryKey,
    profileQueryKeys.watchlists({ profileId, visibilityScope: scope })
  )
  assert.deepEqual(
    reviews.queryKey,
    profileQueryKeys.reviews({ profileId, visibilityScope: scope })
  )
  assert.deepEqual(
    ratings.queryKey,
    profileQueryKeys.ratings({
      filters: { titleIds: ['series-a', 'series-b'] },
      profileId,
      visibilityScope: scope,
    })
  )
  assert.equal((await reviews.queryFn()).totalCount, profileId.length)
  assert.deepEqual(await identity.queryFn(), { id: profileId })
})

test('exposes independent genre, media, rating, and monthly recap queries', async () => {
  const service = createService()
  const genres = profileGenreStatisticsQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
    limit: 5,
  })
  const media = profileMediaStatisticsQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })
  const ratings = profileRatingStatisticsQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })
  const recap = profileMonthlyRecapQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
    year: 2026,
    month: 7,
  })

  assert.equal((await genres.queryFn())[0].name, 'Drama')
  assert.equal((await media.queryFn()).seriesWatched, 4)
  assert.equal((await ratings.queryFn()).averageRating, 3.5)
  assert.equal((await recap.queryFn()).month, 7)
})

test('exposes a dedicated viewing breakdown query with its own cache key', async () => {
  const service = createService()
  const options = profileViewingBreakdownStatisticsQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })

  assert.deepEqual(
    options.queryKey,
    profileQueryKeys.viewingBreakdownStats({
      profileId,
      visibilityScope: scope,
    })
  )
  assert.equal((await options.queryFn()).studioStats[0].name, 'Studio One')
})

test('exposes a dedicated lifetime stats query from the canonical profile id', async () => {
  const service = createService()
  const options = profileLifetimeStatisticsQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
  })

  assert.deepEqual(
    options.queryKey,
    profileQueryKeys.lifetimeStats({ profileId, visibilityScope: scope })
  )
  assert.deepEqual(await options.queryFn(), {
    episodesWatched: 3,
    moviesWatched: 2,
    ratingsMade: 5,
    timeWatchedMinutes: 246,
  })
})

test('starts relationship work from a canonical route id without waiting for unrelated profile sections', async () => {
  const relationshipCalls = []
  const service = {
    ...createService(),
    getFollowRelationship: async (...args) => {
      relationshipCalls.push(args)
      return { isFollowedBy: false, isFollowing: true, isMutual: false }
    },
  }
  const enabled = profileRelationshipQueryOptions({
    profileId,
    service,
    viewerId: 'viewer-a',
  })
  const disabled = profileRelationshipQueryOptions({
    profileId,
    service: createService(),
    viewerId: undefined,
  })

  assert.equal(enabled.enabled, true)
  assert.equal(disabled.enabled, false)
  assert.deepEqual(
    enabled.queryKey,
    profileQueryKeys.relationship({ profileId, viewerId: 'viewer-a' })
  )
  assert.equal((await enabled.queryFn()).isFollowing, true)
  assert.deepEqual(relationshipCalls, [[profileId]])
})

test('preserves successful section data while a refreshed section is pending or fails', async () => {
  const options = profileStatisticsQueryOptions({
    profileId,
    service: createService(),
    visibilityScope: scope,
  })

  assert.deepEqual(
    options.placeholderData(
      { counts: { followers: 4, following: 3 }, publicStats: null },
      { queryKey: options.queryKey }
    ),
    { counts: { followers: 4, following: 3 }, publicStats: null }
  )
  assert.deepEqual(await options.queryFn(), {
    counts: { followers: 4, following: 3 },
    publicStats: {
      diaryEntries: 3,
      moviesWatched: 2,
      reviews: 1,
      seriesWatched: 1,
    },
  })
})

test('never retains section data from a different canonical profile owner', () => {
  const service = createService()
  const options = profileWatchedMoviesQueryOptions({
    profileId: 'profile-b',
    service,
    visibilityScope: scope,
  })

  assert.equal(
    options.placeholderData([{ id: 'movie-a' }], {
      queryKey: profileQueryKeys.watchedMovies({
        profileId: 'profile-a',
        visibilityScope: scope,
      }),
    }),
    undefined
  )
})

test('never retains same-profile content when visibility changes from authenticated to public', () => {
  const service = createService()
  const options = profileWatchedMoviesQueryOptions({
    profileId,
    service,
    visibilityScope: { kind: 'public' },
  })

  assert.equal(
    options.placeholderData([{ id: 'private-movie' }], {
      queryKey: profileQueryKeys.watchedMovies({
        profileId,
        visibilityScope: { kind: 'authenticated', userId: 'viewer-a' },
      }),
    }),
    undefined
  )
})

test('never retains same-profile identity, statistics, or ratings across account scopes', () => {
  const service = createService()
  const nextScope = { kind: 'authenticated', userId: 'viewer-b' }
  const previousScope = { kind: 'authenticated', userId: 'viewer-a' }
  const cases = [
    {
      options: profileIdentityQueryOptions({
        profileId,
        service,
        visibilityScope: nextScope,
      }),
      previousData: { id: profileId },
      previousKey: profileQueryKeys.identity({
        profileId,
        visibilityScope: previousScope,
      }),
    },
    {
      options: profileStatisticsQueryOptions({
        profileId,
        service,
        visibilityScope: nextScope,
      }),
      previousData: {
        counts: { followers: 1, following: 2 },
        publicStats: null,
      },
      previousKey: profileQueryKeys.statistics({
        profileId,
        visibilityScope: previousScope,
      }),
    },
    {
      options: profileRatingsQueryOptions({
        profileId,
        service,
        titleIds: ['series-a'],
        visibilityScope: nextScope,
      }),
      previousData: { 'series-a': 4 },
      previousKey: profileQueryKeys.ratings({
        filters: { titleIds: ['series-a'] },
        profileId,
        visibilityScope: previousScope,
      }),
    },
  ]

  for (const item of cases) {
    assert.equal(
      item.options.placeholderData(item.previousData, {
        queryKey: item.previousKey,
      }),
      undefined
    )
  }
})

test('never retains relationship data when the authenticated viewer owner changes', () => {
  const service = createService()
  const options = profileRelationshipQueryOptions({
    profileId,
    service,
    viewerId: 'viewer-b',
  })

  assert.equal(
    options.placeholderData(
      { isFollowedBy: false, isFollowing: true, isMutual: false },
      {
        queryKey: profileQueryKeys.relationship({
          profileId,
          viewerId: 'viewer-a',
        }),
      }
    ),
    undefined
  )
})

test('passes a sorted mutable title-id copy to the real ratings service signature', async () => {
  const originalTitleIds = Object.freeze(['series-b', 'series-a'])
  let receivedTitleIds
  const service = {
    ...createService(),
    getAverageSeasonRatingsForTitles: async (_id, titleIds) => {
      receivedTitleIds = titleIds
      titleIds.push('service-can-mutate-this-copy')
      return {}
    },
  }
  const options = profileRatingsQueryOptions({
    profileId,
    service,
    titleIds: originalTitleIds,
    visibilityScope: scope,
  })

  await options.queryFn()

  assert.deepEqual(originalTitleIds, ['series-b', 'series-a'])
  assert.deepEqual(receivedTitleIds, ['series-a', 'series-b', 'service-can-mutate-this-copy'])
})

test('builds canonical profile collection query options', async () => {
  const service = createService()
  const collection = [{ id: 'movie-1' }]

  service.getProfileCollectionItemsByProfileId = async (id, mediaType) => {
    service.canonicalCalls.push(['collection', id, mediaType])
    return collection
  }

  const options = profileQueryOptions.profileCollectionQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
    mediaType: 'movie',
  })

  assert.deepEqual(
    options.queryKey,
    profileQueryKeys.collection({
      profileId,
      visibilityScope: scope,
      mediaType: 'movie',
    })
  )

  assert.equal(options.staleTime, 5 * 60 * 1000)
  assert.equal(options.gcTime, 60 * 60 * 1000)

  assert.strictEqual(await options.queryFn(), collection)

  assert.deepEqual(service.canonicalCalls.at(-1), ['collection', profileId, 'movie'])
})

test('derives complete watch passes for series collection results', async () => {
  const service = createService()

  service.getProfileCollectionItemsByProfileId = async () => [
    {
      id: 'series-1',
      mediaType: 'tv',
      title: 'Severance',
      requiredEpisodes: [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 1, episodeNumber: 2 },
      ],
      watchEvents: [
        {
          id: 'watch-4',
          seasonNumber: 1,
          episodeNumber: 2,
          watchedAt: '2026-02-04T20:00:00.000Z',
          watchType: 'rewatch',
        },
        {
          id: 'watch-3',
          seasonNumber: 1,
          episodeNumber: 1,
          watchedAt: '2026-02-03T20:00:00.000Z',
          watchType: 'rewatch',
        },
        {
          id: 'watch-2',
          seasonNumber: 1,
          episodeNumber: 2,
          watchedAt: '2025-01-04T20:00:00.000Z',
          watchType: 'first-time',
        },
        {
          id: 'watch-1',
          seasonNumber: 1,
          episodeNumber: 1,
          watchedAt: '2025-01-03T20:00:00.000Z',
          watchType: 'first-time',
        },
      ],
      seriesPasses: [],
    },
  ]

  const options = profileQueryOptions.profileCollectionQueryOptions({
    profileId,
    service,
    visibilityScope: scope,
    mediaType: 'tv',
  })

  const items = await options.queryFn()

  assert.deepEqual(items[0]?.seriesPasses, [
    {
      passNumber: 1,
      completedAt: '2025-01-04T20:00:00.000Z',
    },
    {
      passNumber: 2,
      completedAt: '2026-02-04T20:00:00.000Z',
    },
  ])
})
