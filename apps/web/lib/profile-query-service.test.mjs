import assert from 'node:assert/strict'
import test from 'node:test'
import { createProfileQueryService } from './profile-query-service.ts'

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
    getPublicProfileStatsByUsername: async (username) => {
      calls.push(['statistics', username])
      return { diaryEntries: 1, moviesWatched: 2, reviews: 3, seriesWatched: 4 }
    },
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
    getPublicProfileStatsByUsername: async () => {
      throw new Error('must not call username provider')
    },
  }
  const service = createProfileQueryService(database)

  assert.deepEqual(await service.getProfileReviewsByProfileId('profile-a', { limit: 6 }), {
    items: [],
    nextCursor: null,
    totalCount: 0,
  })
  assert.equal(await service.getPublicProfileStatsByProfileId('profile-a'), null)
})
