import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const localizedListConsumers = [
  '../app/watchlist/[id].tsx',
  '../components/home/HomeSection.tsx',
  '../components/modals/PersonalityModal.tsx',
  '../components/modals/MediaImageSelectorModal.tsx',
]

for (const relativePath of localizedListConsumers) {
  test(`${relativePath} hydrates one locale-ready batch before rendering title images`, async () => {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /useLocalizedMediaData/)
    assert.match(source, /isPending/)
    assert.doesNotMatch(source, /getImageUrl\([^)]*(cover_image|poster_path)/)
  })
}

test('secondary mobile modals reuse localized list hydration without per-card TMDB details', async () => {
  for (const relativePath of [
    '../components/modals/WatchedMoviesModal.tsx',
    '../components/modals/WatchedSeriesModal.tsx',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /useLocalizedMediaData/)
    assert.doesNotMatch(source, /getMovieDetails|getTVDetails/)
  }
})

test('non-title watchlist and import surfaces do not introduce localized image requests', async () => {
  for (const relativePath of [
    '../app/(tabs)/watchlists.tsx',
    '../components/modals/WatchlistSelectorModal.tsx',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /getMovieDetails|getTVDetails|getMediaImages/)
  }
})

test('mobile import provider details remain a write-path rather than rendered title images', async () => {
  const source = await readFile(new URL('../app/profile/import.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /poster_path|backdrop_path|cover_image/)
})
