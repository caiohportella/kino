import assert from 'node:assert/strict'
import test from 'node:test'

import { filterWatchlistItemsByTitle } from '../../watchlist/watchlist-search.ts'

const items = [
  {
    id: '1',
    title: 'Duna',
  },
  {
    id: '2',
    title: 'O Poderoso Chefão',
  },
  {
    id: '3',
    title: 'Uma Mente Excepcional',
  },
]

test('returns every item for an empty query', () => {
  assert.deepEqual(filterWatchlistItemsByTitle(items, ''), items)
})

test('filters titles case-insensitively', () => {
  assert.deepEqual(filterWatchlistItemsByTitle(items, 'dUnA'), [items[0]])
})

test('filters titles accent-insensitively', () => {
  assert.deepEqual(filterWatchlistItemsByTitle(items, 'chefao'), [items[1]])
})

test('matches a partial localized title', () => {
  assert.deepEqual(filterWatchlistItemsByTitle(items, 'mente'), [items[2]])
})

test('trims the query before matching', () => {
  assert.deepEqual(filterWatchlistItemsByTitle(items, '  duna  '), [items[0]])
})
