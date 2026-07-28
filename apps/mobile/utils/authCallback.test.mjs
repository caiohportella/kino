import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAuthCallbackCompleter,
  getAuthCallbackPayload,
  sanitizeAuthError,
} from './authCallback.ts'

test('parses a PKCE authorization code from the native callback', () => {
  assert.deepEqual(getAuthCallbackPayload('kino://auth/callback?code=short-lived-code'), {
    code: 'short-lived-code',
    accessToken: undefined,
    refreshToken: undefined,
    error: undefined,
  })
})

test('parses legacy fragment tokens without logging or displaying them', () => {
  assert.deepEqual(
    getAuthCallbackPayload('kino://auth/callback#access_token=access&refresh_token=refresh'),
    {
      code: undefined,
      accessToken: 'access',
      refreshToken: 'refresh',
      error: undefined,
    }
  )
})

test('prefers a sanitized provider error', () => {
  const payload = getAuthCallbackPayload(
    'kino://auth/callback?error=access_denied&error_description=provider-details'
  )
  assert.equal(payload.error, 'provider-details')
  assert.equal(
    sanitizeAuthError(payload.error),
    'Google authentication could not be completed. Please try again.'
  )
})

test('rejects malformed callback URLs', () => {
  assert.throws(() => getAuthCallbackPayload('not a url'), TypeError)
})

test('exchanges and consumes a duplicate callback code only once', async () => {
  let exchanges = 0
  let destinations = 0
  const completer = createAuthCallbackCompleter({
    async exchangeCodeForSession(code) {
      exchanges += 1
      assert.equal(code, 'short-lived-code')
      return { error: null }
    },
    async setSession() {
      return { error: null }
    },
    async consumeReturnTo() {
      destinations += 1
      return '/(tabs)/diary'
    },
  })

  const callback = 'kino://auth/callback?code=short-lived-code'
  const [first, duplicate] = await Promise.all([
    completer.complete(callback),
    completer.complete(callback),
  ])
  const repeated = await completer.complete(callback)

  assert.equal(first, '/(tabs)/diary')
  assert.equal(duplicate, '/(tabs)/diary')
  assert.equal(repeated, '/(tabs)/diary')
  assert.equal(exchanges, 1)
  assert.equal(destinations, 1)
})
