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
