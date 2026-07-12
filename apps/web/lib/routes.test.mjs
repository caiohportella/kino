import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isCanonicalResourceSegment,
  parseResourceSegment,
  personPath,
  slugify,
  titlePath,
} from './routes.ts'

test('creates deterministic accent-free slugs', () => {
  assert.equal(slugify('  Amélie: Le Fabuleux Destin!  '), 'amelie-le-fabuleux-destin')
  assert.equal(slugify('Game---of   Thrones'), 'game-of-thrones')
})

test('keeps the numeric id as the lookup source', () => {
  assert.deepEqual(parseResourceSegment('238-the-godfather'), { id: 238, slug: 'the-godfather' })
  assert.deepEqual(parseResourceSegment('238'), { id: 238, slug: '' })
})

test('builds canonical public paths', () => {
  assert.equal(titlePath(238, 'The Godfather', 'movie'), '/title/238-the-godfather?type=movie')
  assert.equal(personPath(3084, 'Marlon Brando'), '/person/3084-marlon-brando')
})

test('detects missing and incorrect slugs for permanent redirects', () => {
  assert.equal(isCanonicalResourceSegment('238-the-godfather', 238, 'The Godfather'), true)
  assert.equal(isCanonicalResourceSegment('238', 238, 'The Godfather'), false)
  assert.equal(isCanonicalResourceSegment('238-wrong-title', 238, 'The Godfather'), false)
})
