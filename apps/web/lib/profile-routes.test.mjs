import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isReservedProfileRoute,
  normalizeProfileUsername,
  profileOgPath,
} from './profile-routes.ts'

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

test('normalizes and safely encodes profile route usernames', () => {
  assert.equal(normalizeProfileUsername('caiohportella'), 'caiohportella')
  assert.equal(normalizeProfileUsername('kino%20fan'), 'kino fan')
  assert.equal(normalizeProfileUsername('%E0%A4%A'), null)
  assert.equal(normalizeProfileUsername('nested/name'), null)
  assert.equal(profileOgPath('kino fan'), '/api/kino%20fan?v=3')
})
