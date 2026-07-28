import assert from 'node:assert/strict'
import test from 'node:test'
import { hasAuthenticatedUser, reduceAuthResolution } from './resolution.ts'

const user = { id: 'user-1' }
const temporary = {
  code: 'temporary_refresh_failure',
  message: 'The session could not be refreshed.',
  recoverable: true,
}
const invalid = {
  code: 'invalid_session',
  message: 'The session is no longer valid.',
  recoverable: false,
}

const transitions = [
  [
    'restores an initial valid session',
    { status: 'resolving' },
    { type: 'SESSION_FOUND', user },
    { status: 'authenticated', user },
  ],
  [
    'resolves an initially absent session',
    { status: 'resolving' },
    { type: 'SESSION_ABSENT' },
    { status: 'unauthenticated' },
  ],
  [
    'retains the authenticated user while a refresh starts',
    { status: 'authenticated', user },
    { type: 'REFRESH_STARTED' },
    { status: 'resolving', previousUser: user },
  ],
  [
    'retains the authenticated user after a temporary refresh failure',
    { status: 'authenticated', user },
    { type: 'REFRESH_FAILED', error: temporary },
    { status: 'error', error: temporary, previousUser: user },
  ],
  [
    'retains the previous user when an in-flight refresh fails',
    { status: 'resolving', previousUser: user },
    { type: 'REFRESH_FAILED', error: temporary },
    { status: 'error', error: temporary, previousUser: user },
  ],
  [
    'clears authentication after explicit logout',
    { status: 'authenticated', user },
    { type: 'SIGNED_OUT' },
    { status: 'unauthenticated' },
  ],
  [
    'does not retain a user after authoritative invalidation',
    { status: 'authenticated', user },
    { type: 'SESSION_INVALIDATED', error: invalid },
    { status: 'error', error: invalid },
  ],
]

for (const [name, state, event, expected] of transitions) {
  test(name, () => {
    assert.deepEqual(reduceAuthResolution(state, event), expected)
  })
}

test('recognizes every resolution that still has authenticated page access', () => {
  assert.equal(hasAuthenticatedUser({ status: 'authenticated', user }), true)
  assert.equal(hasAuthenticatedUser({ status: 'resolving', previousUser: user }), true)
  assert.equal(
    hasAuthenticatedUser({ status: 'error', error: temporary, previousUser: user }),
    true
  )
  assert.equal(hasAuthenticatedUser({ status: 'resolving' }), false)
  assert.equal(hasAuthenticatedUser({ status: 'error', error: invalid }), false)
  assert.equal(hasAuthenticatedUser({ status: 'unauthenticated' }), false)
})
