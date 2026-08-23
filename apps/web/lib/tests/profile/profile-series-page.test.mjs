import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const componentUrl = new URL(
  '../../../components/profile/collections/profile-series-page.tsx',
  import.meta.url
)

test('connects the series collection page to the client profile services', () => {
  let source = ''

  try {
    source = readFileSync(componentUrl, 'utf8')
  } catch {
    assert.fail('ProfileSeriesPage component should exist')
  }

  assert.match(source, /['"]use client['"]/)

  assert.match(source, /ProfileCollectionPage/)
  assert.match(source, /useAuthStore/)
  assert.match(source, /useTranslation/)
  assert.match(source, /@\/lib\/services/)
  assert.match(source, /\bdb\b/)

  assert.match(source, /viewer\?\.id/, 'visibility should depend on the authenticated viewer')

  assert.match(source, /kind:\s*['"]authenticated['"]/)
  assert.match(source, /kind:\s*['"]public['"]/)

  assert.match(source, /mediaType=['"]tv['"]/)
  assert.match(source, /profileId=\{profileId\}/)
  assert.match(source, /service=\{db\}/)
  assert.match(source, /visibilityScope=\{visibilityScope\}/)

  assert.match(
    source,
    /profileHref=\{`\/\$\{encodeURIComponent\(username\)\}`\}/,
    'back navigation should point to the canonical profile'
  )

  assert.match(source, /profileCollections\.backToProfile/)
  assert.match(source, /profileCollections\.seriesTitle/)
  assert.match(source, /profileCollections\.seriesDescription/)
  assert.match(source, /profileCollections\.seriesShareText/)

  assert.match(source, /profileCollections\.seriesEmptyTitle/)
  assert.match(source, /profileCollections\.seriesEmptyBody/)
  assert.match(source, /profileCollections\.loadErrorTitle/)
  assert.match(source, /profileCollections\.loadErrorBody/)
  assert.match(source, /profileCollections\.noMatchesTitle/)
  assert.match(source, /profileCollections\.noMatchesBody/)
})
