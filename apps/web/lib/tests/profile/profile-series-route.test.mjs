import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routeUrl = new URL('../../../app/[username]/series/page.tsx', import.meta.url)

test('defines the public profile series route with canonical metadata and profile resolution', () => {
  let source = ''

  try {
    source = readFileSync(routeUrl, 'utf8')
  } catch {
    assert.fail('profile series route should exist')
  }

  assert.match(source, /generateMetadata/)
  assert.match(source, /normalizeProfileUsername/)
  assert.match(source, /isReservedProfileRoute/)
  assert.match(source, /notFound/)
  assert.match(source, /permanentRedirect/)

  assert.match(
    source,
    /profileSeriesPath\(/,
    'series route should use the canonical profile series route helper'
  )

  assert.match(
    source,
    /absoluteUrl\(profileSeriesPath\(/,
    'metadata canonical URL should point to the series collection route'
  )

  assert.match(source, /metadata\.profileSeriesTitle/)
  assert.match(source, /metadata\.profileSeriesDescription/)

  assert.match(
    source,
    /<ProfileSeriesPage/,
    'the server route should render a serializable client boundary'
  )

  assert.match(source, /profileId=\{profile\.id\}/)
  assert.match(source, /username=\{profile\.username \|\| normalizedUsername\}/)

  assert.doesNotMatch(
    source,
    /\bdb\b/,
    'the server route should not own the client database service'
  )

  assert.doesNotMatch(
    source,
    /visibilityScope/,
    'viewer-specific visibility belongs in the client boundary'
  )
})
