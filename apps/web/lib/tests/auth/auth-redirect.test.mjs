import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getNativeAuthCallbackUrl,
  isExplicitNativeAuthHandoff,
  isSafeInternalRedirect,
} from '../../auth/auth-redirect.ts'

test('only enables the web-to-native bridge explicitly', () => {
  assert.equal(isExplicitNativeAuthHandoff(new URLSearchParams('platform=native')), true)
  assert.equal(isExplicitNativeAuthHandoff(new URLSearchParams()), false)
})

test('builds a Kino callback containing only supplied short-lived parameters', () => {
  assert.equal(
    getNativeAuthCallbackUrl(new URLSearchParams({ code: 'short-lived-code' })),
    'kino://auth/callback?code=short-lived-code'
  )
})

test('validates internal web return destinations', () => {
  assert.equal(isSafeInternalRedirect('/diary'), true)
  assert.equal(isSafeInternalRedirect('//attacker.example'), false)
  assert.equal(isSafeInternalRedirect('/auth/callback'), false)
})
