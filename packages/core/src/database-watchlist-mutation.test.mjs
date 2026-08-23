import assert from 'node:assert/strict'
import test from 'node:test'

import { KinoDatabaseService } from './database.ts'

function createMutationSupabase() {
  const calls = {
    authGetUser: 0,
    insert: [],
    deleteFilters: [],
  }

  const insertedRow = {
    id: 'item-1',
    watchlist_id: 'list-1',
    title_id: 'title-1',
    added_by: 'user-1',
    added_at: '2026-08-21T12:00:00.000Z',
  }

  const supabase = {
    auth: {
      async getUser() {
        calls.authGetUser += 1

        throw new Error('auth.getUser should not be called for watchlist item mutations')
      },
    },

    from(table) {
      assert.equal(table, 'watchlist_items')

      return {
        insert(payload) {
          calls.insert.push(payload)

          const result = {
            data: insertedRow,
            error: null,
          }

          return {
            select() {
              return {
                single: async () => result,

                then(resolve, reject) {
                  return Promise.resolve(result).then(resolve, reject)
                },
              }
            },
          }
        },

        delete() {
          const result = {
            data: null,
            error: null,
          }

          const chain = {
            eq(column, value) {
              calls.deleteFilters.push([column, value])
              return chain
            },

            then(resolve, reject) {
              return Promise.resolve(result).then(resolve, reject)
            },
          }

          return chain
        },
      }
    },
  }

  return {
    calls,
    supabase,
  }
}

test('adds a watchlist item without making a separate auth request', async () => {
  const { calls, supabase } = createMutationSupabase()
  const db = new KinoDatabaseService(supabase)

  await db.addToWatchlist('list-1', 'title-1')

  assert.equal(calls.authGetUser, 0)

  assert.deepEqual(calls.insert, [
    {
      watchlist_id: 'list-1',
      title_id: 'title-1',
    },
  ])
})

test('removes a watchlist item without making a separate auth request', async () => {
  const { calls, supabase } = createMutationSupabase()
  const db = new KinoDatabaseService(supabase)

  await db.removeFromWatchlist('list-1', 'title-1')

  assert.equal(calls.authGetUser, 0)

  assert.deepEqual(calls.deleteFilters, [
    ['watchlist_id', 'list-1'],
    ['title_id', 'title-1'],
  ])
})
