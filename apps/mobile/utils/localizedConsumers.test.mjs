import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('mobile title cards render the locale-ready list poster without a client-side swap', async () => {
  const source = await readFile(
    new URL('../components/common/TitleCard.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(source, /useLocalizedTitle/)
  assert.match(source, /title\.poster_path/)
})

test('mobile diary rows wait for localized title metadata before rendering presentation', async () => {
  const source = await readFile(new URL('../app/(tabs)/diary.tsx', import.meta.url), 'utf8')
  assert.match(source, /isPending:\s*localizedTitlePending/)
  assert.match(source, /if\s*\(localizedTitlePending\)/)
  assert.match(source, /tmdbTitle\?\.poster_path/)
})

test('mobile profile title sections expose and honor localized query readiness', async () => {
  const hook = await readFile(
    new URL('../hooks/data/useLocalizedMediaData.ts', import.meta.url),
    'utf8'
  )
  assert.match(hook, /isPending/)

  for (const relativePath of [
    '../components/profile/WatchedMoviesSection.tsx',
    '../components/profile/WatchedSeriesSection.tsx',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /localizedData\.isPending/)
  }
})

test('mobile detail queries retain locale in their key and render a skeleton while pending', async () => {
  const querySource = await readFile(new URL('../hooks/api/useTMDB.ts', import.meta.url), 'utf8')
  const pageSource = await readFile(new URL('../app/title/[id].tsx', import.meta.url), 'utf8')
  assert.match(querySource, /TMDB_KEYS\.movieDetails\(id,\s*language\)/)
  assert.match(querySource, /TMDB_KEYS\.tvDetails\(id,\s*language\)/)
  assert.match(pageSource, /metaQuery\.isLoading/)
})
