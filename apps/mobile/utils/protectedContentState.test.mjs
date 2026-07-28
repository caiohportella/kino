import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProtectedContentState } from './protectedContentState.ts'

const user = { id: 'user-1' }
const refreshError = {
  code: 'temporary_refresh_failure',
  message: 'Network request failed',
  recoverable: true,
}

test('mobile gives unresolved auth priority over page state', () => {
  assert.equal(
    resolveProtectedContentState({
      resolution: { status: 'resolving' },
      pageStatus: 'empty',
    }),
    'auth-loading'
  )
})

test('mobile does not treat a refresh error with a previous user as logged out', () => {
  assert.equal(
    resolveProtectedContentState({
      resolution: {
        status: 'error',
        error: refreshError,
        previousUser: user,
      },
      pageStatus: 'content',
    }),
    'content'
  )
})

test('mobile gives authenticated page states their documented priority', () => {
  const resolution = { status: 'authenticated', user }

  assert.equal(resolveProtectedContentState({ resolution, pageStatus: 'loading' }), 'page-loading')
  assert.equal(resolveProtectedContentState({ resolution, pageStatus: 'error' }), 'error')
  assert.equal(resolveProtectedContentState({ resolution, pageStatus: 'empty' }), 'empty')
  assert.equal(resolveProtectedContentState({ resolution, pageStatus: 'content' }), 'content')
})
