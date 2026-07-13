import assert from 'node:assert/strict'
import test from 'node:test'
import { isReservedProfileRoute } from './profile-routes.ts'

test('protects application routes from username resolution', () => {
  for (const route of [
    'settings',
    'diary',
    'watchlists',
    'search',
    'auth',
    'title',
    'person',
    'profile',
  ]) {
    assert.equal(isReservedProfileRoute(route), true)
    assert.equal(isReservedProfileRoute(route.toUpperCase()), true)
  }
})

test('allows valid usernames at the application root', () => {
  assert.equal(isReservedProfileRoute('caiohportella'), false)
  assert.equal(isReservedProfileRoute('kino_fan_42'), false)
})
