import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isProfileKnownEmpty,
  selectProfilePageState,
  selectProfileSliceState,
} from '../../profile/profile-progressive-state.ts'

const pending = {
  data: undefined,
  dataOwnerId: undefined,
  error: null,
  fetchStatus: 'fetching',
  status: 'pending',
}

test('identity is the sole page-level blocker and error owner', () => {
  assert.deepEqual(selectProfilePageState(pending, 'profile-a'), { phase: 'blocking' })
  assert.deepEqual(
    selectProfilePageState(
      {
        ...pending,
        error: new Error('missing'),
        fetchStatus: 'idle',
        status: 'error',
      },
      'profile-a'
    ),
    { error: new Error('missing'), phase: 'error' }
  )
  assert.deepEqual(
    selectProfilePageState(
      {
        data: { id: 'profile-a' },
        dataOwnerId: 'profile-a',
        error: null,
        fetchStatus: 'idle',
        status: 'success',
      },
      'profile-a'
    ),
    { identity: { id: 'profile-a' }, phase: 'ready' }
  )
})

test('profile switches never retain another profile identity', () => {
  assert.deepEqual(
    selectProfilePageState(
      {
        data: { id: 'profile-a' },
        dataOwnerId: 'profile-a',
        error: null,
        fetchStatus: 'fetching',
        status: 'success',
      },
      'profile-b'
    ),
    { phase: 'blocking' }
  )
})

test('secondary slices distinguish initial pending, paused, failed, and known empty', () => {
  assert.equal(selectProfileSliceState(pending, 'profile-a').phase, 'initial-pending')
  assert.equal(
    selectProfileSliceState({ ...pending, fetchStatus: 'paused' }, 'profile-a').phase,
    'paused'
  )
  assert.equal(
    selectProfileSliceState(
      { ...pending, error: new Error('failed'), fetchStatus: 'idle', status: 'error' },
      'profile-a'
    ).phase,
    'failed'
  )
  assert.deepEqual(
    selectProfileSliceState(
      {
        data: [],
        dataOwnerId: 'profile-a',
        error: null,
        fetchStatus: 'idle',
        status: 'success',
      },
      'profile-a'
    ),
    { data: [], phase: 'empty' }
  )
})

test('secondary slices retain successful content during refresh and refresh failure', () => {
  const data = [{ id: 'movie-a' }]
  assert.deepEqual(
    selectProfileSliceState(
      {
        data,
        dataOwnerId: 'profile-a',
        error: null,
        fetchStatus: 'fetching',
        status: 'success',
      },
      'profile-a'
    ),
    { data, empty: false, phase: 'retained-refresh' }
  )

  const error = new Error('refresh failed')
  assert.deepEqual(
    selectProfileSliceState(
      {
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

test('profile switches never retain another profile owner data', () => {
  const state = selectProfileSliceState(
    {
      data: [{ id: 'movie-a' }],
      dataOwnerId: 'profile-a',
      error: null,
      fetchStatus: 'fetching',
      status: 'success',
    },
    'profile-b'
  )

  assert.deepEqual(state, { phase: 'initial-pending' })
})

test('empty profile eligibility waits for every relevant slice to become known', () => {
  const empty = { data: [], phase: 'empty' }
  assert.equal(isProfileKnownEmpty([empty, { phase: 'initial-pending' }]), false)
  assert.equal(isProfileKnownEmpty([empty, { error: new Error('x'), phase: 'failed' }]), false)
  assert.equal(isProfileKnownEmpty([empty, empty]), true)
  assert.equal(
    isProfileKnownEmpty([empty, { data: [], empty: true, phase: 'retained-refresh' }]),
    true
  )
  assert.equal(isProfileKnownEmpty([empty, { data: [{ id: 1 }], phase: 'ready' }]), false)
})

test('empty profile eligibility respects custom slice emptiness semantics', () => {
  const customEmpty = selectProfileSliceState(
    {
      data: { items: [] },
      dataOwnerId: 'profile-a',
      error: null,
      fetchStatus: 'idle',
      status: 'success',
    },
    'profile-a',
    (data) => data.items.length === 0
  )

  assert.equal(customEmpty.phase, 'empty')
  assert.equal(isProfileKnownEmpty([customEmpty]), true)

  const retainedCustomEmpty = selectProfileSliceState(
    {
      data: { items: [] },
      dataOwnerId: 'profile-a',
      error: null,
      fetchStatus: 'fetching',
      status: 'success',
    },
    'profile-a',
    (data) => data.items.length === 0
  )
  assert.equal(isProfileKnownEmpty([retainedCustomEmpty]), true)
})
