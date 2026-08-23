import assert from 'node:assert/strict'
import test from 'node:test'
import { createWatchlistCoverVersion } from '@kino/core'

const items = [
  {
    addedAt: '2026-07-26T12:00:00.000Z',
    itemId: 'item-1',
    posterPath: '/poster-1.jpg',
    titleId: 'title-1',
  },
  {
    addedAt: '2026-07-25T12:00:00.000Z',
    itemId: 'item-2',
    posterPath: '/poster-2.jpg',
    titleId: 'title-2',
  },
]

test('watchlist cover versions are deterministic', () => {
  assert.equal(
    createWatchlistCoverVersion('2026-07-26T12:00:00.000Z', 'public', items),
    createWatchlistCoverVersion('2026-07-26T12:00:00.000Z', 'public', items)
  )
})

test('watchlist cover versions change with membership, order, posters, and visibility', () => {
  const original = createWatchlistCoverVersion('2026-07-26T12:00:00.000Z', 'public', items)
  const variants = [
    items.slice(0, 1),
    [...items].reverse(),
    [{ ...items[0], posterPath: '/replacement.jpg' }, items[1]],
  ]

  for (const variant of variants) {
    assert.notEqual(
      createWatchlistCoverVersion('2026-07-26T12:00:00.000Z', 'public', variant),
      original
    )
  }
  assert.notEqual(
    createWatchlistCoverVersion('2026-07-26T12:00:00.000Z', 'private', items),
    original
  )
})
