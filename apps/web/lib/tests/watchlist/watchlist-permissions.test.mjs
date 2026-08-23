import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canEditWatchlist,
  canViewWatchlist,
  watchlistRobots,
} from '../../watchlist/watchlist-permissions.ts'

const anonymous = { isOwner: false, hasInvite: false, canEditInvite: false }

test('private watchlists are owner-only', () => {
  assert.equal(canViewWatchlist('private', anonymous), false)
  assert.equal(canViewWatchlist('private', { ...anonymous, isOwner: true }), true)
})

test('shared watchlists require a valid invitation', () => {
  assert.equal(canViewWatchlist('shared', anonymous), false)
  assert.equal(canViewWatchlist('shared', { ...anonymous, hasInvite: true }), true)
})

test('public visibility grants viewing but never editing', () => {
  assert.equal(canViewWatchlist('public', anonymous), true)
  assert.equal(canEditWatchlist(anonymous), false)
})

test('only owners and explicitly invited editors can edit', () => {
  assert.equal(canEditWatchlist({ ...anonymous, hasInvite: true }), false)
  assert.equal(canEditWatchlist({ ...anonymous, canEditInvite: true }), true)
  assert.equal(canEditWatchlist({ ...anonymous, isOwner: true }), true)
})

test('only public watchlists are indexable', () => {
  assert.deepEqual(watchlistRobots('private'), { index: false, follow: false })
  assert.deepEqual(watchlistRobots('shared'), { index: false, follow: false })
  assert.deepEqual(watchlistRobots('public'), { index: true, follow: true })
})
