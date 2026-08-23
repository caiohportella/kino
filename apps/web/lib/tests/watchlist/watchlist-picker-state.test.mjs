import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adjustWatchlistSummaryCount,
  isTitleWatchlistedFromSelection,
  setWatchlistSelection,
} from '../../watchlist/watchlist-picker-state.ts'

test('optimistically adds a watchlist selection without mutating the original map', () => {
  const original = new Map([['list-1', 'user-1']])

  const next = setWatchlistSelection(original, 'list-2', 'user-1')

  assert.deepEqual(
    [...next.entries()],
    [
      ['list-1', 'user-1'],
      ['list-2', 'user-1'],
    ]
  )

  assert.deepEqual([...original.entries()], [['list-1', 'user-1']])
})

test('optimistically removes a watchlist selection', () => {
  const original = new Map([
    ['list-1', 'user-1'],
    ['list-2', 'user-1'],
  ])

  const next = setWatchlistSelection(original, 'list-1', null)

  assert.deepEqual([...next.entries()], [['list-2', 'user-1']])
})

test('optimistically adjusts only the changed watchlist summary count', () => {
  const original = {
    'list-1': {
      titleCount: 3,
      coverItems: [],
    },
    'list-2': {
      titleCount: 7,
      coverItems: [],
    },
  }

  const next = adjustWatchlistSummaryCount(original, 'list-2', 1)

  assert.equal(next['list-1'], original['list-1'])

  assert.deepEqual(next, {
    'list-1': {
      titleCount: 3,
      coverItems: [],
    },
    'list-2': {
      titleCount: 8,
      coverItems: [],
    },
  })

  assert.deepEqual(original, {
    'list-1': {
      titleCount: 3,
      coverItems: [],
    },
    'list-2': {
      titleCount: 7,
      coverItems: [],
    },
  })
})

test('never lets an optimistic watchlist count go below zero', () => {
  const original = {
    'list-1': {
      titleCount: 0,
      coverItems: [],
    },
  }

  const next = adjustWatchlistSummaryCount(original, 'list-1', -1)

  assert.equal(next['list-1'].titleCount, 0)
})

test('reports a title as watchlisted while any watchlist selection remains', () => {
  const selected = new Map([
    ['list-1', 'user-1'],
    ['list-2', 'user-1'],
  ])

  const afterRemovingOne = setWatchlistSelection(selected, 'list-1', null)

  assert.equal(isTitleWatchlistedFromSelection(afterRemovingOne), true)

  const afterRemovingLast = setWatchlistSelection(afterRemovingOne, 'list-2', null)

  assert.equal(isTitleWatchlistedFromSelection(afterRemovingLast), false)
})
