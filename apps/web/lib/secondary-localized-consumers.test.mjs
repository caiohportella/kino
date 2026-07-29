import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

for (const relativePath of [
  '../app/watchlists/shared/[code]/page.tsx',
  '../components/title-context.tsx',
  '../app/person/[id]/page.tsx',
  '../components/banner-picker-dialog.tsx',
]) {
  test(`${relativePath} batches locale-ready summaries before rendering title images`, async () => {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /useLocalizedTitles/)
    assert.match(source, /isPending/)
    assert.match(source, /resolveLocalizedTitlePresentation/)
    assert.doesNotMatch(source, /getImageUrl\([^)]*(cover_image|poster_path)/)
  })
}

test('owned and shared watchlist title grids avoid persisted poster presentation', async () => {
  for (const relativePath of [
    '../app/watchlists/[id]/page.tsx',
    '../app/watchlists/shared/[code]/page.tsx',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /localizedTitle/)
    assert.match(source, /resolveLocalizedTitlePresentation/)
    assert.doesNotMatch(source, /getImageUrl\(item\.title\.cover_image/)
    assert.doesNotMatch(source, /localized\?\.title\s*\|\|\s*item\.title\.title/)
  }
})

test('non-title web consumers do not create localization fan-out', async () => {
  for (const relativePath of [
    '../app/watchlists/page.tsx',
    '../components/profile-search-card.tsx',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /getMovieDetails|getTVDetails|getMediaImages/)
  }
})

test('web import provider details remain a write-path rather than rendered title images', async () => {
  const source = await readFile(new URL('../app/import/page.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /poster_path|backdrop_path|cover_image/)
})
