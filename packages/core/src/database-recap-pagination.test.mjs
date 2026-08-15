import assert from 'node:assert/strict'
import test from 'node:test'

import { KinoDatabaseService } from './database.ts'

function movieDiaryRow(index) {
  return {
    title_id: 'movie-1',
    watched_at: `2024-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    watch_type: 'first-time',
    titles: {
      id: 'movie-1',
      tmdb_id: 1,
      title: 'Movie 1',
      type: 'movie',
      release_year: 2024,
      genres: [],
      runtime: 90,
      episode_runtime: null,
      production_companies: [],
      cast: [],
      tmdb_data: null,
      cover_image: null,
    },
  }
}

function movieRatingRow() {
  return {
    ...movieDiaryRow(0),
    rating: 4,
  }
}

function createPaginatedSupabase(rowsByTable, calls) {
  return {
    from(table) {
      const state = { from: 0, to: null }
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        not() {
          return query
        },
        order(column, options) {
          calls.push({ kind: 'order', table, column, options })
          return query
        },
        range(from, to) {
          state.from = from
          state.to = to
          calls.push({ kind: 'range', table, from, to })
          return query
        },
        then(resolve, reject) {
          const rows = rowsByTable[table] ?? []
          const data = state.to == null ? rows.slice(0, 1000) : rows.slice(state.from, state.to + 1)
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
}

test('lifetime recap paginates every complete activity source with stable ordering', async () => {
  const calls = []
  const service = new KinoDatabaseService(
    createPaginatedSupabase(
      {
        watch_diary: Array.from({ length: 1001 }, (_, index) => movieDiaryRow(index)),
        title_ratings: [movieRatingRow()],
        episode_ratings: [],
      },
      calls
    )
  )
  service.getProfileLifetimeStatsByProfileId = async () => ({
    moviesWatched: 1001,
    episodesWatched: 0,
    ratingsMade: 0,
    timeWatchedMinutes: 90_090,
  })
  service.getWatchedSeries = async () => []

  const recap = await service.getProfileLifetimeRecapByProfileId('profile-1')

  assert.equal(recap.topRatedMovies[0]?.count, 1001)

  for (const table of ['watch_diary', 'title_ratings', 'episode_ratings']) {
    assert(calls.some((call) => call.kind === 'range' && call.table === table))
    const orderedColumns = calls
      .filter((call) => call.kind === 'order' && call.table === table)
      .map((call) => call.column)

    assert(orderedColumns.length > 0)
    for (let index = 0; index < orderedColumns.length; index += 3) {
      assert.deepEqual(orderedColumns.slice(index, index + 3), ['watched_at', 'title_id', 'id'])
    }
  }
})
