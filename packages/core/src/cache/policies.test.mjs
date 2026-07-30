import assert from 'node:assert/strict'
import test from 'node:test'
import { profileCachePolicies } from './policies.ts'

test('defines named cache policies for every progressive profile query boundary', () => {
  assert.deepEqual(Object.keys(profileCachePolicies), [
    'usernameResolution',
    'identity',
    'relationship',
    'watchedMovies',
    'watchedSeries',
    'statistics',
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
