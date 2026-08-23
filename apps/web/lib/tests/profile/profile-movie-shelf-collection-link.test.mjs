import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const movieShelfUrl = new URL(
  '../../../components/profile/profile-movie-shelf.tsx',
  import.meta.url
)

const titleRowUrl = new URL('../../../components/profile/profile-title-row.tsx', import.meta.url)

test('links the movie shelf bounded preview to the public movies collection', () => {
  const source = readFileSync(movieShelfUrl, 'utf8')

  assert.match(source, /username:\s*string/)
  assert.match(source, /profileMoviesPath/)

  assert.match(
    source,
    /showAllHref=\{profileMoviesPath\(username\)\}/,
    'movie shelf should navigate to the public movies collection'
  )

  assert.match(
    source,
    /previewLimit=\{15\}/,
    'profile movie shelf should remain a compact fifteen-title preview'
  )

  assert.doesNotMatch(
    source,
    /desktopShowAllAction/,
    'movie shelf should no longer opt into modal show-all behavior'
  )

  assert.match(
    source,
    /items\.slice\(0,\s*15\)\.map/,
    'movie shelf should localize the same fifteen items it previews'
  )
})

test('supports a navigational show-all mode without a modal or end card', () => {
  const source = readFileSync(titleRowUrl, 'utf8')

  assert.match(source, /showAllHref\?:\s*string/)
  assert.match(source, /previewLimit\?:\s*number/)

  assert.match(
    source,
    /items\.slice\(0,\s*previewLimit\)/,
    'the row should render only its bounded preview'
  )

  assert.match(source, /href=\{showAllHref\}/, 'navigation mode should render a real link')

  assert.match(
    source,
    /profile\.viewAll/,
    'collection navigation should use the existing View all vocabulary'
  )

  assert.match(
    source,
    /hasMore\s*&&\s*!showAllHref/,
    'modal-only behavior must be disabled when a collection href is provided'
  )
})
