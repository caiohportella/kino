import assert from 'node:assert/strict'
import test from 'node:test'
import { getAuthCallbackPayload, sanitizeAuthError } from './authCallback.ts'

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
