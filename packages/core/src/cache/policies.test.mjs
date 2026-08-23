import assert from 'node:assert/strict'
import test from 'node:test'
import { activityCachePolicies, profileCachePolicies } from './policies.ts'

test('defines named cache policies for every progressive profile query boundary', () => {
  assert.deepEqual(Object.keys(profileCachePolicies), [
    'usernameResolution',
    'identity',
    'relationship',
    'collection',
    'watchedMovies',
    'watchedSeries',
    'diaryEntries',
    'statistics',
    'lifetimeStats',
    'mediaStats',
    'viewingBreakdownStats',
    'genreStats',
    'ratingStats',
    'monthlyRecap',
    'watchlists',
    'reviews',
    'ratings',
    'availability',
  ])

  for (const policy of Object.values(profileCachePolicies)) {
    assert.equal(typeof policy.staleTime, 'number')
    assert.equal(typeof policy.gcTime, 'number')
    assert.ok(policy.staleTime > 0)
    assert.ok(policy.gcTime >= policy.staleTime)
  }
})

test('keeps viewer relationship data and availability on their own refresh cadences', () => {
  assert.ok(profileCachePolicies.relationship.staleTime < profileCachePolicies.identity.staleTime)
  assert.ok(
    profileCachePolicies.availability.staleTime > profileCachePolicies.watchedSeries.staleTime
  )
})

test('activity feed cache policy keeps items fresh for a short window and retains them briefly', () => {
  assert.deepEqual(Object.keys(activityCachePolicies), ['feed'])
  assert.equal(typeof activityCachePolicies.feed.staleTime, 'number')
  assert.equal(typeof activityCachePolicies.feed.gcTime, 'number')
  assert.ok(activityCachePolicies.feed.staleTime > 0)
  assert.ok(activityCachePolicies.feed.gcTime >= activityCachePolicies.feed.staleTime)
})

test('uses profile section freshness for collection pages', () => {
  assert.deepEqual(profileCachePolicies.collection, {
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
})