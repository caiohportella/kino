import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProtectedContentState } from './protected-content-state.ts'

const user = { id: 'user-1' }
const refreshError = {
  code: 'temporary_refresh_failure',
  message: 'Network request failed',
  recoverable: true,
}
const invalidError = {
  code: 'invalid_session',
  message: 'The session is no longer valid.',
  recoverable: false,
}

const cases = [
  [
    'prioritizes unresolved auth over an empty page',
    { resolution: { status: 'resolving' }, pageStatus: 'empty' },
    'auth-loading',
  ],
  [
    'renders unauthenticated only after definitive absence',
    { resolution: { status: 'unauthenticated' }, pageStatus: 'content' },
    'unauthenticated',
  ],
  [
    'surfaces definitive auth errors before page content',
    {
      resolution: { status: 'error', error: invalidError },
      pageStatus: 'content',
    },
    'error',
  ],
  [
    'renders page loading after authentication',
    { resolution: { status: 'authenticated', user }, pageStatus: 'loading' },
    'page-loading',
  ],
  [
    'renders page errors after authentication',
    { resolution: { status: 'authenticated', user }, pageStatus: 'error' },
    'error',
  ],
  [
    'renders an authenticated empty page',
    { resolution: { status: 'authenticated', user }, pageStatus: 'empty' },
    'empty',
  ],
  [
    'renders authenticated content',
    { resolution: { status: 'authenticated', user }, pageStatus: 'content' },
    'content',
  ],
  [
    'keeps page access after a recoverable refresh error',
    {
      resolution: {
        status: 'error',
        error: refreshError,
        previousUser: user,
      },
      pageStatus: 'content',
    },
    'content',
  ],
]

for (const [name, input, expected] of cases) {
  test(name, () => {
    assert.equal(resolveProtectedContentState(input), expected)
  })
}
