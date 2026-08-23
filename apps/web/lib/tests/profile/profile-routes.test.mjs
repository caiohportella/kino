import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isProfileSectionPath,
  isReservedProfileRoute,
  normalizeProfileUsername,
  profileOgPath,
} from '../../profile/profile-routes.ts'

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
    'movies',
    'series',
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
  assert.equal(profileOgPath('kino fan'), '/api/kino%20fan?v=4')
})

test('detects authenticated profile section paths', () => {
  assert.equal(isProfileSectionPath('/caio', 'caio'), true)
  assert.equal(isProfileSectionPath('/caio/stats', 'caio'), true)
  assert.equal(isProfileSectionPath('/caio/stats/recap/2026/08', 'caio'), true)

  assert.equal(isProfileSectionPath('/other', 'caio'), false)
  assert.equal(isProfileSectionPath('/other/stats', 'caio'), false)
  assert.equal(isProfileSectionPath('/Caio', 'caio'), false)

  for (const pathname of ['', 'caio', '/', '/discover', '/settings']) {
    assert.equal(isProfileSectionPath(pathname, 'caio'), false)
  }
})
