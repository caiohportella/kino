import assert from 'node:assert/strict'
import test from 'node:test'
import { profileQueryKeys } from '@kino/core/cache'
import { keepPreviousData } from '@tanstack/react-query'
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
} from './profile-query-options.ts'

const scope = { kind: 'authenticated', userId: 'viewer-a' }
const profileId = 'profile-a'

function createService() {
  return {
    getAverageSeasonRatingsForTitles: async (id, titleIds) => ({ [id]: titleIds.length }),
    getFollowCounts: async () => ({ followers: 4, following: 3 }),
    getFollowRelationship: async () => ({
      isFollowedBy: false,
      isFollowing: true,
      isMutual: false,
    }),
    getProfileReviews: async (username) => ({
      items: [],
      nextCursor: null,
      totalCount: username.length,
    }),
    getPublicProfileStatsByUsername: async () => ({
      diaryEntries: 3,
      moviesWatched: 2,
      reviews: 1,
      seriesWatched: 1,
    }),
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
  const identity = profileIdentityQueryOptions({ profileId, service, visibilityScope: scope })
  const movies = profileWatchedMoviesQueryOptions({ profileId, service, visibilityScope: scope })
  const series = profileWatchedSeriesQueryOptions({ profileId, service, visibilityScope: scope })
  const watchlists = profileWatchlistsQueryOptions({ profileId, service, visibilityScope: scope })
  const reviews = profileReviewsQueryOptions({
    profileId,
    service,
    username: 'ada',
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
  assert.deepEqual(await identity.queryFn(), { id: profileId })
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
    username: 'ada',
    visibilityScope: scope,
  })

  assert.equal(options.placeholderData, keepPreviousData)
  assert.deepEqual(await options.queryFn(), {
    counts: { followers: 4, following: 3 },
    publicStats: { diaryEntries: 3, moviesWatched: 2, reviews: 1, seriesWatched: 1 },
  })
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
