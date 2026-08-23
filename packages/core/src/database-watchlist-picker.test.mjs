import assert from 'node:assert/strict'
import test from 'node:test'

import { KinoDatabaseService } from './database.ts'

function createSupabase(rows, calls) {
  return {
    from(table) {
      calls.push({
        kind: 'from',
        table,
      })

      const query = {
        select() {
          return query
        },

        in(column, values) {
          calls.push({
            kind: 'in',
            table,
            column,
            values,
          })

          return query
        },

        order(column, options) {
          calls.push({
            kind: 'order',
            table,
            column,
            options,
          })

          return query
        },

        then(resolve, reject) {
          return Promise.resolve({
            data: rows,
            error: null,
          }).then(resolve, reject)
        },
      }

      return query
    },
  }
}

test('builds watchlist picker summaries with counts and recent unique covers in one query', async () => {
  const calls = []

  const service = new KinoDatabaseService(
    createSupabase(
      [
        {
          id: 'item-1',
          watchlist_id: 'list-1',
          added_at: '2026-08-04T00:00:00.000Z',
          title: {
            tmdb_id: 101,
            type: 'movie',
            cover_image: '/poster-a.jpg',
          },
        },
        {
          id: 'item-2',
          watchlist_id: 'list-1',
          added_at: '2026-08-03T00:00:00.000Z',
          title: {
            tmdb_id: 102,
            type: 'movie',
            cover_image: '/poster-b.jpg',
          },
        },
        {
          id: 'item-3',
          watchlist_id: 'list-1',
          added_at: '2026-08-02T00:00:00.000Z',
          title: {
            tmdb_id: 103,
            type: 'movie',
            cover_image: '/poster-a.jpg',
          },
        },
        {
          id: 'item-4',
          watchlist_id: 'list-2',
          added_at: '2026-08-01T00:00:00.000Z',
          title: {
            tmdb_id: 201,
            type: 'tv',
            cover_image: null,
          },
        },
      ],
      calls
    )
  )

  const summaries = await service.getWatchlistPickerSummaries(['list-1', 'list-2', 'list-3'])

  assert.deepEqual(summaries, {
    'list-1': {
      titleCount: 3,
      coverItems: [
        {
          tmdbId: 101,
          type: 'movie',
          fallbackCoverImage: '/poster-a.jpg',
        },
        {
          tmdbId: 102,
          type: 'movie',
          fallbackCoverImage: '/poster-b.jpg',
        },
        {
          tmdbId: 103,
          type: 'movie',
          fallbackCoverImage: '/poster-a.jpg',
        },
      ],
    },
    'list-2': {
      titleCount: 1,
      coverItems: [
        {
          tmdbId: 201,
          type: 'tv',
          fallbackCoverImage: null,
        },
      ],
    },
    'list-3': {
      titleCount: 0,
      coverItems: [],
    },
  })

  assert.equal(
    calls.filter((call) => call.kind === 'from' && call.table === 'watchlist_items').length,
    1
  )

  assert(
    calls.some(
      (call) =>
        call.kind === 'in' &&
        call.table === 'watchlist_items' &&
        call.column === 'watchlist_id' &&
        JSON.stringify(call.values) === JSON.stringify(['list-1', 'list-2', 'list-3'])
    )
  )
})

test('gets title contributors for known watchlists without reloading watchlists', async () => {
  const calls = []

  const result = {
    data: [
      {
        watchlist_id: 'list-2',
        added_by: 'user-1',
      },
    ],
    error: null,
  }

  const supabase = {
    from(table) {
      calls.push(['from', table])

      const chain = {
        select(columns) {
          calls.push(['select', columns])
          return chain
        },

        eq(column, value) {
          calls.push(['eq', column, value])
          return chain
        },

        in(column, values) {
          calls.push(['in', column, values])
          return chain
        },

        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject)
        },
      }

      return chain
    },
  }

  const db = new KinoDatabaseService(supabase)

  const contributors = await db.getWatchlistTitleContributorsForWatchlists('title-1', [
    'list-1',
    'list-2',
  ])

  assert.deepEqual(contributors, [
    {
      watchlist_id: 'list-2',
      added_by: 'user-1',
    },
  ])

  assert.deepEqual(
    calls.filter(([type]) => type === 'from'),
    [['from', 'watchlist_items']]
  )

  assert.ok(
    calls.some(
      ([type, column, value]) => type === 'eq' && column === 'title_id' && value === 'title-1'
    )
  )

  assert.ok(
    calls.some(
      ([type, column, values]) =>
        type === 'in' &&
        column === 'watchlist_id' &&
        JSON.stringify(values) === JSON.stringify(['list-1', 'list-2'])
    )
  )
})

test('builds picker summaries and title contributors from one watchlist-items query', async () => {
  const calls = []

  const rows = [
    {
      id: 'item-3',
      watchlist_id: 'list-1',
      title_id: 'title-2',
      added_by: 'user-1',
      added_at: '2026-08-21T12:00:00.000Z',
      title: {
        tmdb_id: 202,
        type: 'movie',
        cover_image: '/two.jpg',
      },
    },
    {
      id: 'item-2',
      watchlist_id: 'list-1',
      title_id: 'title-1',
      added_by: 'user-1',
      added_at: '2026-08-20T12:00:00.000Z',
      title: {
        tmdb_id: 101,
        type: 'movie',
        cover_image: '/one.jpg',
      },
    },
    {
      id: 'item-1',
      watchlist_id: 'list-2',
      title_id: 'title-1',
      added_by: 'user-2',
      added_at: '2026-08-19T12:00:00.000Z',
      title: {
        tmdb_id: 101,
        type: 'movie',
        cover_image: '/one.jpg',
      },
    },
  ]

  const result = {
    data: rows,
    error: null,
  }

  const supabase = {
    from(table) {
      calls.push(['from', table])

      const chain = {
        select(columns) {
          calls.push(['select', columns])
          return chain
        },

        in(column, values) {
          calls.push(['in', column, values])
          return chain
        },

        order(column, options) {
          calls.push(['order', column, options])
          return chain
        },

        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject)
        },
      }

      return chain
    },
  }

  const db = new KinoDatabaseService(supabase)

  const picker = await db.getWatchlistPickerData(['list-1', 'list-2'], 'title-1')

  assert.equal(calls.filter(([type]) => type === 'from').length, 1)

  assert.deepEqual(
    calls.filter(([type]) => type === 'from'),
    [['from', 'watchlist_items']]
  )

  assert.deepEqual(picker.selected, [
    {
      watchlist_id: 'list-1',
      added_by: 'user-1',
    },
    {
      watchlist_id: 'list-2',
      added_by: 'user-2',
    },
  ])

  assert.equal(picker.summaries['list-1'].titleCount, 2)
  assert.equal(picker.summaries['list-2'].titleCount, 1)

  assert.deepEqual(picker.summaries['list-1'].coverItems, [
    {
      tmdbId: 202,
      type: 'movie',
      fallbackCoverImage: '/two.jpg',
    },
    {
      tmdbId: 101,
      type: 'movie',
      fallbackCoverImage: '/one.jpg',
    },
  ])
})
