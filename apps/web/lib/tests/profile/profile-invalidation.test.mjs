import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  profileInvalidationKeys,
  profileMutationInvalidationDescriptors,
  profileMutationInvalidationKeys,
} from '../../profile/profile-invalidation.ts'

const publicScope = { kind: 'public' }

test('maps every progressive invalidation descriptor to canonical query keys', () => {
  const cases = [
    {
      descriptor: { kind: 'identity', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'identity', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'relationship', profileId: 'profile-a', viewerId: 'viewer-a' },
      expected: [['v1', 'profile', 'relationship', 'profile-a', 'viewer-a']],
    },
    {
      descriptor: {
        kind: 'watched-movies',
        profileId: 'profile-a',
        visibilityScope: publicScope,
      },
      expected: [['v1', 'profile', 'watched-movies', 'profile-a', 'public']],
    },
    {
      descriptor: {
        kind: 'watched-series',
        profileId: 'profile-a',
        visibilityScope: publicScope,
      },
      expected: [['v1', 'profile', 'watched-series', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'statistics', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'statistics', 'profile-a', 'public']],
    },
    {
      descriptor: {
        kind: 'lifetime-stats',
        profileId: 'profile-a',
        visibilityScope: publicScope,
      },
      expected: [['v1', 'profile', 'lifetime-stats', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'media-stats', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'media-stats', 'profile-a', 'public']],
    },
    {
      descriptor: {
        kind: 'viewing-breakdown-stats',
        profileId: 'profile-a',
        visibilityScope: publicScope,
      },
      expected: [['v1', 'profile', 'viewing-breakdown-stats', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'genre-stats', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'genre-stats', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'rating-stats', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'rating-stats', 'profile-a', 'public']],
    },
    {
      descriptor: { kind: 'monthly-recap', profileId: 'profile-a', visibilityScope: publicScope },
      expected: [['v1', 'profile', 'monthly-recap', 'profile-a', 'public']],
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

  for (const { descriptor, expected } of cases) {
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

test('maps profile mutations to the smallest correct descriptor sets', () => {
  const authenticatedScope = { kind: 'authenticated', userId: 'viewer-a' }
  const cases = [
    {
      mutation: {
        kind: 'rating-diary',
        mediaType: 'movie',
        profileId: 'profile-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: [
        'watched-movies',
        'watched-movies',
        'statistics',
        'statistics',
        'lifetime-stats',
        'lifetime-stats',
        'genre-stats',
        'genre-stats',
        'viewing-breakdown-stats',
        'viewing-breakdown-stats',
        'rating-stats',
        'rating-stats',
        'monthly-recap',
        'monthly-recap',
        'ratings',
        'ratings',
      ],
    },
    {
      mutation: {
        kind: 'rating-diary',
        mediaType: 'tv',
        profileId: 'profile-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: [
        'watched-series',
        'watched-series',
        'statistics',
        'statistics',
        'lifetime-stats',
        'lifetime-stats',
        'genre-stats',
        'genre-stats',
        'viewing-breakdown-stats',
        'viewing-breakdown-stats',
        'rating-stats',
        'rating-stats',
        'monthly-recap',
        'monthly-recap',
        'ratings',
        'ratings',
      ],
    },
    {
      mutation: {
        kind: 'identity',
        profileId: 'profile-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: ['identity', 'identity'],
    },
    {
      mutation: {
        kind: 'watchlist',
        profileId: 'profile-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: ['watchlists', 'watchlists'],
    },
    {
      mutation: {
        kind: 'review',
        profileId: 'profile-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: ['reviews', 'reviews'],
    },
    {
      mutation: {
        kind: 'follow',
        profileId: 'profile-a',
        viewerId: 'viewer-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: [
        'relationship',
        'statistics',
        'statistics',
        'lifetime-stats',
        'lifetime-stats',
        'statistics',
        'statistics',
      ],
    },
    {
      mutation: {
        kind: 'banner',
        profileId: 'profile-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: ['identity', 'identity'],
    },
    {
      mutation: {
        kind: 'subscription',
        profileId: 'profile-a',
        visibilityScope: authenticatedScope,
      },
      expectedKinds: ['watchlists', 'watchlists'],
    },
  ]

  for (const { mutation, expectedKinds } of cases) {
    assert.deepEqual(
      profileMutationInvalidationDescriptors(mutation).map(({ kind }) => kind),
      expectedKinds
    )
  }
})

test('follow descriptors keep canonical profile and viewer ownership', () => {
  const descriptors = profileMutationInvalidationDescriptors({
    kind: 'follow',
    profileId: 'profile-a',
    viewerId: 'viewer-a',
    visibilityScope: { kind: 'authenticated', userId: 'viewer-a' },
  })

  assert.deepEqual(descriptors[0], {
    kind: 'relationship',
    profileId: 'profile-a',
    viewerId: 'viewer-a',
  })
  assert.deepEqual(descriptors[3], {
    kind: 'lifetime-stats',
    profileId: 'profile-a',
    visibilityScope: { kind: 'public' },
  })
})

test('profile writes invalidate public and authenticated visibility variants', () => {
  for (const kind of ['banner', 'identity', 'review', 'subscription', 'watchlist']) {
    const mutation = {
      kind,
      profileId: 'author-a',
      visibilityScope: { kind: 'authenticated', userId: 'viewer-a' },
    }
    const descriptors = profileMutationInvalidationDescriptors(mutation)
    assert.ok(
      descriptors.some(({ visibilityScope }) => visibilityScope?.kind === 'public'),
      `${kind} must describe public data`
    )
    assert.ok(
      descriptors.some(
        ({ visibilityScope }) =>
          visibilityScope?.kind === 'authenticated' && visibilityScope.userId === 'viewer-a'
      ),
      `${kind} must describe authenticated data`
    )
    assert.ok(
      profileMutationInvalidationKeys(mutation).some(
        (key) => key.includes('author-a') && key.length === 4
      ),
      `${kind} must execute through a profile-owned prefix that covers every visibility`
    )
  }

  const ratingDescriptors = profileMutationInvalidationDescriptors({
    kind: 'rating-diary',
    mediaType: 'movie',
    profileId: 'author-a',
    visibilityScope: { kind: 'authenticated', userId: 'viewer-a' },
  })
  assert.ok(
    ratingDescriptors.some(
      ({ kind, visibilityScope }) => kind === 'watched-movies' && visibilityScope.kind === 'public'
    )
  )
  assert.ok(
    profileMutationInvalidationKeys({
      kind: 'rating-diary',
      mediaType: 'movie',
      profileId: 'author-a',
      visibilityScope: { kind: 'authenticated', userId: 'viewer-a' },
    }).some((key) => key[2] === 'watched-movies' && key[3] === 'author-a' && key.length === 4)
  )
})

test('review invalidation is owned by the author rather than the viewer', () => {
  const keys = profileMutationInvalidationKeys({
    kind: 'review',
    profileId: 'author-a',
    visibilityScope: { kind: 'authenticated', userId: 'viewer-a' },
  })

  assert.deepEqual(keys, [['v1', 'profile', 'reviews', 'author-a']])
})

test('identity writes invalidate the username-resolution root', () => {
  assert.ok(
    profileMutationInvalidationKeys({
      kind: 'identity',
      profileId: 'profile-a',
      visibilityScope: { kind: 'authenticated', userId: 'profile-a' },
    }).some(
      (key) =>
        key[0] === 'v1' &&
        key[1] === 'profile' &&
        key[2] === 'username-resolution' &&
        key.length === 3
    )
  )
})

test('profile review mutations do not invalidate the removed username-keyed profile cache', () => {
  const hookSource = readFileSync(
    new URL('../../../hooks/profile/use-profile-reviews.ts', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(hookSource, /\['profile-by-username',\s*username\]/)
})

test('review-like consumers carry author ownership into canonical invalidation', () => {
  const hookSource = readFileSync(
    new URL('../../../hooks/title/use-title-reviews.ts', import.meta.url),
    'utf8'
  )
  const callerSource = readFileSync(
    new URL('../../../components/reviews/reviews-section.tsx', import.meta.url),
    'utf8'
  )

  assert.match(hookSource, /useSharedReviewLikeMutation/)
  assert.match(callerSource, /authorProfileId:\s*review\.userId/)
})
