import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routeUrl = new URL('../../../app/[username]/movies/page.tsx', import.meta.url)

test('defines the public profile movies route with canonical metadata and profile resolution', () => {
  let source = ''

  try {
    source = readFileSync(routeUrl, 'utf8')
  } catch {
    assert.fail('profile movies route should exist')
  }

  assert.match(source, /generateMetadata/)
  assert.match(source, /normalizeProfileUsername/)
  assert.match(source, /isReservedProfileRoute/)
  assert.match(source, /notFound/)
  assert.match(source, /permanentRedirect/)

  assert.match(
    source,
    /profileMoviesPath\(/,
    'movies route should use the canonical profile movies route helper'
  )

  assert.match(
    source,
    /absoluteUrl\(profileMoviesPath\(/,
    'metadata canonical URL should point to the movies collection route'
  )

  assert.match(
    source,
    /metadata\.profileMoviesTitle/,
    'movies route should have dedicated localized metadata title copy'
  )

  assert.match(
    source,
    /metadata\.profileMoviesDescription/,
    'movies route should have dedicated localized metadata description copy'
  )

  assert.match(
    source,
    /<ProfileMoviesPage/,
    'the server route should render a serializable client boundary'
  )

  assert.match(source, /profileId=\{profile\.id\}/)
  assert.match(source, /username=\{profile\.username \|\| normalizedUsername\}/)

  assert.doesNotMatch(
    source,
    /\bdb\b/,
    'the server route should not pass the client database service'
  )

  assert.doesNotMatch(
    source,
    /visibilityScope/,
    'viewer-specific visibility belongs in the client boundary'
  )
})
