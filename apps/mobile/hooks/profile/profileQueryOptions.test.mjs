import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient } from '@tanstack/query-core'
import {
  profileIdentityQueryOptions,
  profileRelationshipQueryOptions,
  profileWatchedMoviesQueryOptions,
  profileWatchedSeriesQueryOptions,
} from './profileQueryOptions.ts'

const service = {
  getFollowCounts: async () => ({ followers: 2, following: 3 }),
  checkFollowStatus: async () => true,
  getUserProfile: async (profileId) => ({ id: profileId }),
  getWatchedMovies: async () => [],
  getWatchedSeries: async () => [],
}

test('mobile profile options use canonical profile ids and shared cache policies', () => {
  const identity = profileIdentityQueryOptions({
    profileId: ' profile-a ',
    service,
    visibilityScope: { kind: 'public' },
  })
  const movies = profileWatchedMoviesQueryOptions({
    profileId: 'profile-a',
    service,
    visibilityScope: { kind: 'public' },
  })
  const series = profileWatchedSeriesQueryOptions({
    profileId: 'profile-a',
    service,
    visibilityScope: { kind: 'public' },
  })

  assert.deepEqual(identity.queryKey, ['v1', 'profile', 'identity', 'profile-a', 'public'])
  assert.deepEqual(movies.queryKey.slice(0, 5), [
    'v1',
    'profile',
    'watched-movies',
    'profile-a',
    'public',
  ])
  assert.deepEqual(series.queryKey.slice(0, 5), [
    'v1',
    'profile',
    'watched-series',
    'profile-a',
    'public',
  ])
  assert.ok(identity.staleTime > 0)
  assert.ok(movies.gcTime >= movies.staleTime)
})

test('relationship options are viewer scoped and retain public counts without a viewer', async () => {
  const viewerA = profileRelationshipQueryOptions({
    profileId: 'profile-a',
    service,
    viewerId: 'viewer-a',
  })
  const viewerB = profileRelationshipQueryOptions({
    profileId: 'profile-a',
    service,
    viewerId: 'viewer-b',
  })
  const anonymous = profileRelationshipQueryOptions({
    profileId: 'profile-a',
    service,
  })

  assert.notDeepEqual(viewerA.queryKey, viewerB.queryKey)
  assert.deepEqual(viewerA.queryKey, ['v1', 'profile', 'relationship', 'profile-a', 'viewer-a'])
  assert.equal(viewerA.enabled, true)
  assert.equal(anonymous.enabled, true)
  assert.deepEqual(anonymous.queryKey, ['v1', 'profile', 'relationship', 'profile-a', 'anonymous'])
  assert.deepEqual(await anonymous.queryFn(), {
    counts: { followers: 2, following: 3 },
    isFollowing: false,
  })
})

test('switching profile or viewer never retains another owners data', async () => {
  const client = new QueryClient()
  const ownerA = profileIdentityQueryOptions({
    profileId: 'profile-a',
    service,
    visibilityScope: { kind: 'public' },
  })
  await client.fetchQuery(ownerA)

  const ownerB = profileIdentityQueryOptions({
    profileId: 'profile-b',
    service,
    visibilityScope: { kind: 'public' },
  })
  assert.equal(
    ownerB.placeholderData({ id: 'profile-a' }, { queryKey: ownerA.queryKey }),
    undefined
  )

  const viewerA = profileRelationshipQueryOptions({
    profileId: 'profile-a',
    service,
    viewerId: 'viewer-a',
  })
  const viewerB = profileRelationshipQueryOptions({
    profileId: 'profile-a',
    service,
    viewerId: 'viewer-b',
  })
  assert.equal(
    viewerB.placeholderData(
      { counts: { followers: 2, following: 3 }, isFollowing: true },
      { queryKey: viewerA.queryKey }
    ),
    undefined
  )
  client.clear()
})

test('relationship refresh replaces the single rendered count source', async () => {
  let followers = 2
  let countReads = 0
  const relationshipService = {
    ...service,
    getFollowCounts: async () => {
      countReads += 1
      return { followers, following: 3 }
    },
  }
  const client = new QueryClient()
  const options = profileRelationshipQueryOptions({
    profileId: 'profile-a',
    service: relationshipService,
    viewerId: 'viewer-a',
  })

  assert.equal((await client.fetchQuery(options)).counts.followers, 2)
  followers = 4
  assert.equal((await client.fetchQuery({ ...options, staleTime: 0 })).counts.followers, 4)
  assert.equal(countReads, 2)
  client.clear()
})
