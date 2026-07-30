import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  selectMobileProfilePageState,
  selectMobileProfileSliceState,
} from './profileProgressiveState.ts'

const pending = {
  data: undefined,
  dataOwnerId: undefined,
  error: null,
  fetchStatus: 'fetching',
  status: 'pending',
}

test('only identity controls the page-level status', () => {
  assert.equal(selectMobileProfilePageState(pending, 'profile-a').phase, 'blocking')
  assert.deepEqual(
    selectMobileProfilePageState(
      {
        ...pending,
        data: { id: 'profile-a' },
        dataOwnerId: 'profile-a',
        fetchStatus: 'idle',
        status: 'success',
      },
      'profile-a'
    ),
    { identity: { id: 'profile-a' }, phase: 'ready' }
  )
})

test('content slices distinguish initial, paused, empty, and failed states', () => {
  assert.equal(selectMobileProfileSliceState(pending, 'profile-a').phase, 'initial-pending')
  assert.equal(
    selectMobileProfileSliceState({ ...pending, fetchStatus: 'paused' }, 'profile-a').phase,
    'paused'
  )
  assert.equal(
    selectMobileProfileSliceState(
      {
        ...pending,
        error: new Error('movies failed'),
        fetchStatus: 'idle',
        status: 'error',
      },
      'profile-a'
    ).phase,
    'failed'
  )
  assert.equal(
    selectMobileProfileSliceState(
      {
        ...pending,
        data: [],
        dataOwnerId: 'profile-a',
        fetchStatus: 'idle',
        status: 'success',
      },
      'profile-a'
    ).phase,
    'empty'
  )
})

test('successful data is retained during refresh and refresh failure', () => {
  const data = [{ id: 'movie-a' }]
  assert.deepEqual(
    selectMobileProfileSliceState(
      { ...pending, data, dataOwnerId: 'profile-a', status: 'success' },
      'profile-a'
    ),
    { data, empty: false, phase: 'retained-refresh' }
  )
  const error = new Error('offline')
  assert.deepEqual(
    selectMobileProfileSliceState(
      {
        ...pending,
        data,
        dataOwnerId: 'profile-a',
        error,
        fetchStatus: 'idle',
        status: 'error',
      },
      'profile-a'
    ),
    { data, empty: false, error, phase: 'retained-refresh-error' }
  )
})

test('data from another profile is never presented', () => {
  assert.equal(
    selectMobileProfileSliceState(
      {
        ...pending,
        data: [{ id: 'movie-a' }],
        dataOwnerId: 'profile-a',
        fetchStatus: 'idle',
        status: 'success',
      },
      'profile-b'
    ).phase,
    'initial-pending'
  )
})

test('the compatibility facade is identity-blocking and has no initial TMDB fan-out', async () => {
  const source = await readFile(new URL('./useProfileData.ts', import.meta.url), 'utf8')
  assert.match(source, /useProfileSections\(targetUserId, viewerId\)/)
  assert.match(source, /loading:\s*identity\.phase === 'blocking'/)
  assert.match(source, /relationshipState:\s*sections\.relationshipState/)
  assert.match(source, /retryRelationship:\s*sections\.retryRelationship/)
  assert.doesNotMatch(source, /refreshSeriesAvailability|getSeasonDetails|getTMDbService/)
})

test('both profile screens own relationship and content failure states independently', async () => {
  for (const relativePath of ['../../app/profile/[id].tsx', '../../app/(tabs)/profile.tsx']) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /relationshipState/)
    assert.match(source, /retryRelationship/)
    assert.match(source, /relationshipHasData/)
    assert.match(source, /relationshipState\.phase === 'paused'/)
    assert.match(source, /relationshipState\.phase === 'retained-refresh-error'/)
    assert.match(source, /onPress=\{retryRelationship\}/)
    assert.match(source, /relationshipHasData\s*\?\s*\(/)
    assert.match(source, /relationshipKnown=\{relationshipHasData\}/)
    assert.match(source, /watchedMoviesState/)
    assert.match(source, /watchedSeriesState/)
    assert.match(source, /watchedMoviesState\.phase === 'paused'/)
    assert.match(source, /watchedSeriesState\.phase === 'paused'/)
    assert.match(source, /watchedMoviesState\.phase === 'retained-refresh-error'/)
    assert.match(source, /watchedSeriesState\.phase === 'retained-refresh-error'/)
    assert.match(source, /onPress=\{retryWatchedMovies\}/)
    assert.match(source, /onPress=\{retryWatchedSeries\}/)
    assert.match(source, /useProfileData\(targetUserId, user\?\.id\)/)
  }
})

test('the profile header hides follow state until relationship evidence is known', async () => {
  const source = await readFile(
    new URL('../../components/profile/ProfileHeader.tsx', import.meta.url),
    'utf8'
  )
  assert.match(source, /relationshipKnown\?: boolean/)
  assert.match(source, /!isOwnProfile && relationshipKnown &&/)
})

test('follow actions only consume relationship data from a valid or retained slice', async () => {
  const source = await readFile(new URL('./useFollowSystem.ts', import.meta.url), 'utf8')
  assert.match(source, /relationshipAvailable/)
  assert.match(source, /if \(!relationshipAvailable\) return/)
  assert.doesNotMatch(source, /relationship\?\.counts\.followers \?\? 0/)
  assert.doesNotMatch(source, /relationship\?\.isFollowing \?\? false/)
})
