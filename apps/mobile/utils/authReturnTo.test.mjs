import assert from 'node:assert/strict'
import test from 'node:test'
import { isSafeNativeReturnTo } from './authReturnTo.ts'

test('accepts only safe internal native return destinations', () => {
  assert.equal(isSafeNativeReturnTo('/(tabs)/diary'), true)
  assert.equal(isSafeNativeReturnTo('/profile/user-1'), true)
})

test('rejects external, auth-loop, encoded, and backslash return destinations', () => {
  assert.equal(isSafeNativeReturnTo('https://example.com'), false)
  assert.equal(isSafeNativeReturnTo('//example.com'), false)
  assert.equal(isSafeNativeReturnTo('/%2Fexample.com'), false)
  assert.equal(isSafeNativeReturnTo('/\\example.com'), false)
  assert.equal(isSafeNativeReturnTo('/auth/callback'), false)
  assert.equal(isSafeNativeReturnTo('/(auth)/login'), false)
})
