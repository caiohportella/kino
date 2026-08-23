import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const seriesShelfUrl = new URL(
  '../../../components/profile/profile-series-shelf.tsx',
  import.meta.url
)

const overviewUrl = new URL('../../../components/profile/profile-overview.tsx', import.meta.url)

test('links only the watched-series preview to the public series collection', () => {
  const source = readFileSync(seriesShelfUrl, 'utf8')

  assert.match(source, /username:\s*string/)
  assert.match(source, /profileSeriesPath/)

  assert.match(
    source,
    /items=\{watchedSeries\}[\s\S]*?previewLimit=\{15\}[\s\S]*?showAllHref=\{profileSeriesPath\(username\)\}/,
    'watched series should be a fifteen-title preview linked to the public collection'
  )

  assert.equal(
    (source.match(/profileSeriesPath\(username\)/g) ?? []).length,
    1,
    'only the watched-series row should link to the full series collection'
  )
})

test('keeps keep-watching and returning-soon rows on their existing modal behavior', () => {
  const source = readFileSync(seriesShelfUrl, 'utf8')

  assert.match(source, /showAllHref\?:\s*string/)
  assert.match(source, /previewLimit\?:\s*number/)

  assert.match(
    source,
    /desktopShowAllAction=\{!showAllHref\}/,
    'rows without a collection href should preserve the existing modal show-all behavior'
  )

  assert.match(source, /previewLimit=\{previewLimit\}/)
  assert.match(source, /showAllHref=\{showAllHref\}/)
})

test('passes the canonical profile username into the series shelf', () => {
  const source = readFileSync(overviewUrl, 'utf8')

  assert.match(
    source,
    /<ProfileSeriesShelf(?=[^>]*items=\{series\})(?=[^>]*username=\{username\})[^>]*\/>/,
    'ProfileSeriesShelf should receive username on the same component invocation'
  )
})
