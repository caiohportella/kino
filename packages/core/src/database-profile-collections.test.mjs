import assert from 'node:assert/strict'
import test from 'node:test'

import { KinoDatabaseService } from './database.ts'

function createSupabase(rowsByTable = {}) {
  return {
    from(table) {
      const filters = []

      const query = {
        select() {
          return query
        },
        eq(column, value) {
          filters.push((row) => row[column] === value)
          return query
        },
        in() {
          return query
        },
        not() {
          return query
        },
        gt() {
          return query
        },
        order() {
          return query
        },
        range() {
          return query
        },
        limit() {
          return query
        },
        then(resolve, reject) {
          const rows = rowsByTable[table] ?? []
          const data = rows.filter((row) => filters.every((filter) => filter(row)))

          return Promise.resolve({
            data,
            error: null,
          }).then(resolve, reject)
        },
      }

      return query
    },
  }
}

test('normalizes repeated movie watches into one profile collection item', async () => {
  const service = new KinoDatabaseService(
    createSupabase({
      watch_diary: [
        {
          id: 'watch-2',
          user_id: 'profile-1',
          title_id: 'movie-1',
          watched_at: '2026-02-10T20:00:00.000Z',
          watch_type: 'rewatch',
          notes: null,
          created_at: '2026-02-10T20:00:00.000Z',
          updated_at: '2026-02-11T20:00:00.000Z',
          titles: {
            id: 'movie-1',
            tmdb_id: 348,
            title: 'Alien',
            type: 'movie',
            release_year: 1979,
            genres: [{ id: 878, name: 'Science Fiction' }],
            runtime: 117,
            episode_runtime: null,
            cover_image: '/alien.jpg',
            tmdb_data: {
              original_title: 'Alien',
              vote_average: 8.2,
              vote_count: 15_000,
              popularity: 75.5,
            },
          },
        },
        {
          id: 'watch-1',
          user_id: 'profile-1',
          title_id: 'movie-1',
          watched_at: '2025-01-05T20:00:00.000Z',
          watch_type: 'first-time',
          notes: null,
          created_at: '2025-01-05T20:00:00.000Z',
          updated_at: '2025-01-05T20:00:00.000Z',
          titles: {
            id: 'movie-1',
            tmdb_id: 348,
            title: 'Alien',
            type: 'movie',
            release_year: 1979,
            genres: [{ id: 878, name: 'Science Fiction' }],
            runtime: 117,
            episode_runtime: null,
            cover_image: '/alien.jpg',
            tmdb_data: {
              original_title: 'Alien',
              vote_average: 8.2,
              vote_count: 15_000,
              popularity: 75.5,
            },
          },
        },
      ],
      title_ratings: [
        {
          id: 'rating-1',
          user_id: 'profile-1',
          title_id: 'movie-1',
          rating: 4.5,
          watched_at: '2026-02-10T20:00:00.000Z',
          watch_type: 'rewatch',
          created_at: '2026-02-10T20:00:00.000Z',
          updated_at: '2026-02-12T20:00:00.000Z',
        },
      ],
      episode_ratings: [],
    })
  )

  const items = await service.getProfileCollectionItemsByProfileId('profile-1', 'movie')

  assert.equal(items.length, 1)

  assert.deepEqual(items[0], {
    id: 'movie-1',
    tmdbId: 348,
    mediaType: 'movie',
    title: 'Alien',
    originalTitle: 'Alien',
    releaseYear: 1979,
    genres: [{ id: 878, name: 'Science Fiction' }],
    posterPath: '/alien.jpg',
    userRating: 4.5,
    averageRating: 4.5,
    ratingCount: 1,
    tmdbRating: 8.2,
    tmdbVoteCount: 15_000,
    tmdbPopularity: 75.5,
    runtimeMinutes: 117,
    latestWatchedAt: '2026-02-10T20:00:00.000Z',
    latestActivityAt: '2026-02-12T20:00:00.000Z',
    watchCount: 2,
    watchEvents: [
      {
        id: 'watch-2',
        watchedAt: '2026-02-10T20:00:00.000Z',
        watchType: 'rewatch',
      },
      {
        id: 'watch-1',
        watchedAt: '2025-01-05T20:00:00.000Z',
        watchType: 'first-time',
      },
    ],
    seriesPasses: [],
  })
})

test('uses the latest review update for collection activity', async () => {
  const service = new KinoDatabaseService(
    createSupabase({
      watch_diary: [
        {
          id: 'watch-1',
          user_id: 'profile-1',
          title_id: 'movie-1',
          watched_at: '2026-01-10T20:00:00.000Z',
          watch_type: 'first-time',
          notes: null,
          created_at: '2026-01-10T20:00:00.000Z',
          updated_at: '2026-01-10T20:00:00.000Z',
          titles: {
            id: 'movie-1',
            tmdb_id: 348,
            title: 'Alien',
            type: 'movie',
            release_year: 1979,
            genres: [],
            runtime: 117,
            episode_runtime: null,
            cover_image: null,
            tmdb_data: null,
          },
        },
      ],
      title_ratings: [
        {
          id: 'rating-1',
          user_id: 'profile-1',
          title_id: 'movie-1',
          rating: 4.5,
          updated_at: '2026-02-10T20:00:00.000Z',
        },
      ],
      episode_ratings: [],
      reviews: [
        {
          id: 'review-1',
          user_id: 'profile-1',
          title_id: 'movie-1',
          media_type: 'movie',
          content: 'Still incredible.',
          rating: 4.5,
          created_at: '2026-03-01T20:00:00.000Z',
          updated_at: '2026-03-05T20:00:00.000Z',
        },
      ],
    })
  )

  const items = await service.getProfileCollectionItemsByProfileId('profile-1', 'movie')

  assert.equal(items[0]?.latestActivityAt, '2026-03-05T20:00:00.000Z')
})

test('includes Kino community rating statistics separately from TMDB ratings', async () => {
  const service = new KinoDatabaseService(
    createSupabase({
      watch_diary: [
        {
          id: 'watch-1',
          user_id: 'profile-1',
          title_id: 'movie-1',
          watched_at: '2026-02-10T20:00:00.000Z',
          watch_type: 'first-time',
          notes: null,
          created_at: '2026-02-10T20:00:00.000Z',
          updated_at: '2026-02-10T20:00:00.000Z',
          titles: {
            id: 'movie-1',
            tmdb_id: 348,
            title: 'Alien',
            type: 'movie',
            release_year: 1979,
            genres: [],
            runtime: 117,
            episode_runtime: null,
            cover_image: null,
            tmdb_data: {
              vote_average: 8.2,
              vote_count: 15_000,
              popularity: 75.5,
            },
          },
        },
      ],
      title_ratings: [
        {
          id: 'rating-1',
          user_id: 'profile-1',
          title_id: 'movie-1',
          rating: 4,
          updated_at: '2026-02-10T20:00:00.000Z',
        },
        {
          id: 'rating-2',
          user_id: 'profile-2',
          title_id: 'movie-1',
          rating: 5,
          updated_at: '2026-02-11T20:00:00.000Z',
        },
      ],
      episode_ratings: [],
    })
  )

  const items = await service.getProfileCollectionItemsByProfileId('profile-1', 'movie')

  assert.equal(items[0]?.tmdbRating, 8.2)
  assert.equal(items[0]?.tmdbVoteCount, 15_000)

  assert.equal(items[0]?.averageRating, 4.5)
  assert.equal(items[0]?.ratingCount, 2)
})

test('normalizes series episode history into one profile collection item', async () => {
  const service = new KinoDatabaseService(
    createSupabase({
      watch_diary: [],
      title_ratings: [],
      episode_ratings: [
        {
          id: 'episode-watch-4',
          user_id: 'profile-1',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 2,
          rating: 4.5,
          watch_type: 'rewatch',
          watched_at: '2026-02-04T20:00:00.000Z',
          runtime_minutes: 52,
          created_at: '2026-02-04T20:00:00.000Z',
          updated_at: '2026-02-05T20:00:00.000Z',
          title: {
            id: 'series-1',
            tmdb_id: 95396,
            title: 'Severance',
            type: 'tv',
            release_year: 2022,
            genres: [{ id: 18, name: 'Drama' }],
            runtime: null,
            episode_runtime: 50,
            cover_image: '/severance.jpg',
            seasons_metadata: [
              {
                season_number: 0,
                episode_count: 1,
              },
              {
                season_number: 1,
                episode_count: 2,
              },
            ],
            tmdb_data: {
              original_name: 'Severance',
              vote_average: 8.7,
              vote_count: 8_000,
              popularity: 110.5,
            },
          },
        },
        {
          id: 'episode-watch-3',
          user_id: 'profile-1',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 1,
          rating: 4,
          watch_type: 'rewatch',
          watched_at: '2026-02-03T20:00:00.000Z',
          runtime_minutes: 48,
          created_at: '2026-02-03T20:00:00.000Z',
          updated_at: '2026-02-03T20:00:00.000Z',
          title: {
            id: 'series-1',
            tmdb_id: 95396,
            title: 'Severance',
            type: 'tv',
            release_year: 2022,
            genres: [{ id: 18, name: 'Drama' }],
            runtime: null,
            episode_runtime: 50,
            cover_image: '/severance.jpg',
            seasons_metadata: [
              { season_number: 0, episode_count: 1 },
              { season_number: 1, episode_count: 2 },
            ],
            tmdb_data: {
              original_name: 'Severance',
              vote_average: 8.7,
              vote_count: 8_000,
              popularity: 110.5,
            },
          },
        },
        {
          id: 'episode-watch-2',
          user_id: 'profile-1',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 2,
          rating: null,
          watch_type: 'first-time',
          watched_at: '2025-01-04T20:00:00.000Z',
          runtime_minutes: 52,
          created_at: '2025-01-04T20:00:00.000Z',
          updated_at: '2025-01-04T20:00:00.000Z',
          title: {
            id: 'series-1',
            tmdb_id: 95396,
            title: 'Severance',
            type: 'tv',
            release_year: 2022,
            genres: [{ id: 18, name: 'Drama' }],
            runtime: null,
            episode_runtime: 50,
            cover_image: '/severance.jpg',
            seasons_metadata: [
              { season_number: 0, episode_count: 1 },
              { season_number: 1, episode_count: 2 },
            ],
            tmdb_data: {
              original_name: 'Severance',
              vote_average: 8.7,
              vote_count: 8_000,
              popularity: 110.5,
            },
          },
        },
        {
          id: 'episode-watch-1',
          user_id: 'profile-1',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 1,
          rating: null,
          watch_type: 'first-time',
          watched_at: '2025-01-03T20:00:00.000Z',
          runtime_minutes: 48,
          created_at: '2025-01-03T20:00:00.000Z',
          updated_at: '2025-01-03T20:00:00.000Z',
          title: {
            id: 'series-1',
            tmdb_id: 95396,
            title: 'Severance',
            type: 'tv',
            release_year: 2022,
            genres: [{ id: 18, name: 'Drama' }],
            runtime: null,
            episode_runtime: 50,
            cover_image: '/severance.jpg',
            seasons_metadata: [
              { season_number: 0, episode_count: 1 },
              { season_number: 1, episode_count: 2 },
            ],
            tmdb_data: {
              original_name: 'Severance',
              vote_average: 8.7,
              vote_count: 8_000,
              popularity: 110.5,
            },
          },
        },
      ],
      reviews: [],
    })
  )

  service.getAverageSeasonRatingsForTitles = async () => ({
    'series-1': 4.25,
  })

  const items = await service.getProfileCollectionItemsByProfileId('profile-1', 'tv')

  assert.equal(items.length, 1)

  assert.deepEqual(items[0], {
    id: 'series-1',
    tmdbId: 95396,
    mediaType: 'tv',
    title: 'Severance',
    originalTitle: 'Severance',
    releaseYear: 2022,
    genres: [{ id: 18, name: 'Drama' }],
    posterPath: '/severance.jpg',
    userRating: 4.25,
    averageRating: 4.25,
    ratingCount: 1,
    tmdbRating: 8.7,
    tmdbVoteCount: 8_000,
    tmdbPopularity: 110.5,
    runtimeMinutes: 50,
    latestWatchedAt: '2026-02-04T20:00:00.000Z',
    latestActivityAt: '2026-02-05T20:00:00.000Z',
    watchCount: 4,
    watchEvents: [
      {
        id: 'episode-watch-4',
        watchedAt: '2026-02-04T20:00:00.000Z',
        watchType: 'rewatch',
        seasonNumber: 1,
        episodeNumber: 2,
        runtimeMinutes: 52,
      },
      {
        id: 'episode-watch-3',
        watchedAt: '2026-02-03T20:00:00.000Z',
        watchType: 'rewatch',
        seasonNumber: 1,
        episodeNumber: 1,
        runtimeMinutes: 48,
      },
      {
        id: 'episode-watch-2',
        watchedAt: '2025-01-04T20:00:00.000Z',
        watchType: 'first-time',
        seasonNumber: 1,
        episodeNumber: 2,
        runtimeMinutes: 52,
      },
      {
        id: 'episode-watch-1',
        watchedAt: '2025-01-03T20:00:00.000Z',
        watchType: 'first-time',
        seasonNumber: 1,
        episodeNumber: 1,
        runtimeMinutes: 48,
      },
    ],
    seriesPasses: [],
    requiredEpisodes: [
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 1, episodeNumber: 2 },
    ],
  })
})

test('includes Kino community episode rating statistics for series', async () => {
  const seriesTitle = {
    id: 'series-1',
    tmdb_id: 95396,
    title: 'Severance',
    type: 'tv',
    release_year: 2022,
    genres: [{ id: 18, name: 'Drama' }],
    runtime: null,
    episode_runtime: 50,
    cover_image: null,
    seasons_metadata: [{ season_number: 1, episode_count: 2 }],
    tmdb_data: {
      vote_average: 8.7,
      vote_count: 8_000,
      popularity: 110.5,
    },
  }

  const service = new KinoDatabaseService(
    createSupabase({
      watch_diary: [],
      title_ratings: [],
      episode_ratings: [
        {
          id: 'profile-watch-1',
          user_id: 'profile-1',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 1,
          rating: 4,
          watch_type: 'first-time',
          watched_at: '2026-01-01T20:00:00.000Z',
          runtime_minutes: 48,
          created_at: '2026-01-01T20:00:00.000Z',
          updated_at: '2026-01-01T20:00:00.000Z',
          title: seriesTitle,
        },
        {
          id: 'profile-watch-2',
          user_id: 'profile-1',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 2,
          rating: 5,
          watch_type: 'first-time',
          watched_at: '2026-01-02T20:00:00.000Z',
          runtime_minutes: 52,
          created_at: '2026-01-02T20:00:00.000Z',
          updated_at: '2026-01-02T20:00:00.000Z',
          title: seriesTitle,
        },
        {
          id: 'community-rating-1',
          user_id: 'profile-2',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 1,
          rating: 3,
          watch_type: 'first-time',
          watched_at: '2026-01-03T20:00:00.000Z',
          runtime_minutes: 48,
          created_at: '2026-01-03T20:00:00.000Z',
          updated_at: '2026-01-03T20:00:00.000Z',
          title: seriesTitle,
        },
      ],
      reviews: [],
    })
  )

  service.getAverageSeasonRatingsForTitles = async () => ({
    'series-1': 4.5,
  })

  const items = await service.getProfileCollectionItemsByProfileId('profile-1', 'tv')

  assert.equal(items[0]?.userRating, 4.5)

  assert.equal(items[0]?.averageRating, 4)
  assert.equal(items[0]?.ratingCount, 2)

  assert.equal(items[0]?.tmdbRating, 8.7)
  assert.equal(items[0]?.tmdbVoteCount, 8_000)
})

test('uses the latest series review update for collection activity', async () => {
  const seriesTitle = {
    id: 'series-1',
    tmdb_id: 95396,
    title: 'Severance',
    type: 'tv',
    release_year: 2022,
    genres: [{ id: 18, name: 'Drama' }],
    runtime: null,
    episode_runtime: 50,
    cover_image: null,
    seasons_metadata: [{ season_number: 1, episode_count: 1 }],
    tmdb_data: null,
  }

  const service = new KinoDatabaseService(
    createSupabase({
      watch_diary: [],
      title_ratings: [],
      episode_ratings: [
        {
          id: 'episode-watch-1',
          user_id: 'profile-1',
          title_id: 'series-1',
          season_number: 1,
          episode_number: 1,
          rating: 4.5,
          watch_type: 'first-time',
          watched_at: '2026-01-10T20:00:00.000Z',
          runtime_minutes: 50,
          created_at: '2026-01-10T20:00:00.000Z',
          updated_at: '2026-02-10T20:00:00.000Z',
          title: seriesTitle,
        },
      ],
      reviews: [
        {
          id: 'review-1',
          user_id: 'profile-1',
          title_id: 'series-1',
          media_type: 'tv',
          content: 'Excellent season.',
          rating: 4.5,
          created_at: '2026-03-01T20:00:00.000Z',
          updated_at: '2026-03-05T20:00:00.000Z',
        },
      ],
    })
  )

  service.getAverageSeasonRatingsForTitles = async () => ({
    'series-1': 4.5,
  })

  const items = await service.getProfileCollectionItemsByProfileId('profile-1', 'tv')

  assert.equal(items[0]?.latestActivityAt, '2026-03-05T20:00:00.000Z')
})
