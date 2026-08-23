import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getDiscoverSeriesUpdates,
  selectDiscoverSeriesUpdateCandidates,
} from '../../discover/series-updates.ts'

const NOW = new Date('2026-08-21T12:00:00.000Z')

function series(overrides = {}) {
  return {
    tmdb_id: 100,
    title: 'Example Series',
    latest_watched_at: '2026-08-01T12:00:00.000Z',
    next_episode: null,
    is_caught_up: false,
    watched_episode_keys: ['1-1'],
    seasons_metadata: [],
    ...overrides,
  }
}

test('recent unwatched released episode becomes a discover update', () => {
  const result = getDiscoverSeriesUpdates(
    [
      series({
        next_episode: {
          season: 2,
          episode: 4,
          air_date: '2026-08-18',
        },
      }),
    ],
    NOW
  )

  assert.deepEqual(result, [
    {
      tmdbId: 100,
      kind: 'episode',
      season: 2,
      episode: 4,
      airDate: '2026-08-18',
    },
  ])
})

test('old unwatched episode is not treated as news', () => {
  const result = getDiscoverSeriesUpdates(
    [
      series({
        next_episode: {
          season: 1,
          episode: 5,
          air_date: '2026-04-10',
        },
      }),
    ],
    NOW
  )

  assert.deepEqual(result, [])
})

test('caught-up series with an upcoming season becomes a season update', () => {
  const result = getDiscoverSeriesUpdates(
    [
      series({
        is_caught_up: true,
        watched_episode_keys: ['1-1', '1-2', '1-3'],
        seasons_metadata: [
          {
            season_number: 1,
            episode_count: 3,
            air_date: '2025-01-10',
          },
          {
            season_number: 2,
            episode_count: 8,
            air_date: '2026-09-05',
          },
        ],
      }),
    ],
    NOW
  )

  assert.deepEqual(result, [
    {
      tmdbId: 100,
      kind: 'season',
      season: 2,
      episode: null,
      airDate: '2026-09-05',
    },
  ])
})

test('season too far in the future is not shown yet', () => {
  const result = getDiscoverSeriesUpdates(
    [
      series({
        is_caught_up: true,
        watched_episode_keys: ['1-1'],
        seasons_metadata: [
          {
            season_number: 1,
            episode_count: 1,
            air_date: '2025-01-01',
          },
          {
            season_number: 2,
            episode_count: 8,
            air_date: '2027-03-01',
          },
        ],
      }),
    ],
    NOW
  )

  assert.deepEqual(result, [])
})

test('recent episode updates appear before future season updates', () => {
  const result = getDiscoverSeriesUpdates(
    [
      series({
        tmdb_id: 200,
        is_caught_up: true,
        watched_episode_keys: ['1-1'],
        seasons_metadata: [
          {
            season_number: 1,
            episode_count: 1,
            air_date: '2025-01-01',
          },
          {
            season_number: 2,
            episode_count: 8,
            air_date: '2026-08-25',
          },
        ],
      }),

      series({
        tmdb_id: 300,
        next_episode: {
          season: 3,
          episode: 2,
          air_date: '2026-08-20',
        },
      }),
    ],
    NOW
  )

  assert.deepEqual(
    result.map((item) => item.tmdbId),
    [300, 200]
  )
})

test('series update candidates prefer recently watched series', () => {
  const result = selectDiscoverSeriesUpdateCandidates(
    [
      {
        tmdb_id: 1,
        latest_watched_at: '2026-01-01T12:00:00Z',
      },
      {
        tmdb_id: 2,
        latest_watched_at: '2026-08-20T12:00:00Z',
      },
      {
        tmdb_id: 3,
        latest_watched_at: '2026-07-15T12:00:00Z',
      },
    ],
    2
  )

  assert.deepEqual(
    result.map((item) => item.tmdb_id),
    [2, 3]
  )
})

test('series update candidates are bounded', () => {
  const series = Array.from({ length: 20 }, (_, index) => ({
    tmdb_id: index + 1,
    latest_watched_at: `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
  }))

  assert.equal(selectDiscoverSeriesUpdateCandidates(series).length, 12)
})
