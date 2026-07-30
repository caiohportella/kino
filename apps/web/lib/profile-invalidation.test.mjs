import assert from 'node:assert/strict'
import test from 'node:test'
import { profileInvalidationKeys } from './profile-invalidation.ts'

const publicScope = { kind: 'public' }

test('maps every progressive invalidation descriptor to canonical query keys', () => {
  const descriptors = [
    {
      descriptor: { kind: 'identity', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'identity', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'relationship', profileId: 'profile-a', viewerId: 'viewer-a' },
      expected: [['v1', 'profile', 'relationship', 'profile-a', 'viewer-a']],
    },
    {
      descriptor: { kind: 'watched-movies', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'watched-movies', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'watched-series', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'watched-series', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'statistics', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'statistics', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'watchlists', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'watchlists', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'reviews', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'reviews', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'ratings', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'ratings', 'profile-a', 'public']],
    },
  ]

  for (const { descriptor, expected } of descriptors) {
    assert.deepEqual(profileInvalidationKeys(descriptor), expected)
  }
})

test('relationship invalidation ownership changes across logout and login', () => {
  assert.notDeepEqual(
    profileInvalidationKeys({
      kind: 'relationship',
      profileId: 'profile-a',
      viewerId: 'viewer-a',
    }),
    profileInvalidationKeys({
      kind: 'relationship',
      profileId: 'profile-a',
      viewerId: 'viewer-b',
    })
  )
})
