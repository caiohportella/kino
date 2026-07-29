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
  assert.match(source, /prefetchTitleSummary/)
  assert.match(source, /seedTitleSummary/)
})

test('mobile diary rows use only verified localized summaries or the Kino placeholder', async () => {
  const source = await readFile(new URL('../app/(tabs)/diary.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /useTitleDetailsFromTmdb/)
  assert.match(source, /localizedMediaKey/)
  assert.doesNotMatch(source, /item\.coverImage/)
  assert.match(source, /placeholderPoster/)
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
    assert.match(source, /localizedMediaKey/)
    assert.doesNotMatch(source, /\.cover_image\s*\\?/)
  }
})

test('mobile missing or rejected localization never reveals persisted posters', async () => {
  const diary = await readFile(new URL('../app/(tabs)/diary.tsx', import.meta.url), 'utf8')
  assert.match(
    diary,
    /localizedPoster\s*\?\s*\{\s*uri:\s*localizedPoster\s*\}\s*:\s*placeholderPoster/
  )

  for (const relativePath of [
    '../components/profile/WatchedMoviesSection.tsx',
    '../components/profile/WatchedSeriesSection.tsx',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /localized\?\.poster_path/)
    assert.match(source, /:\s*placeholderPoster/)
    assert.doesNotMatch(source, /uri:\s*(?:movie|item)\.cover_image/)
  }
})

test('mobile localized list hydration never fans out into per-card TMDB detail requests', async () => {
  const source = await readFile(
    new URL('../hooks/data/useLocalizedMediaData.ts', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(source, /getMovieDetails|getTVDetails/)
  assert.match(source, /titleQueryKeys/)
})

test('mobile detail consumers use canonical detail options and compatible summary placeholders', async () => {
  const querySource = await readFile(
    new URL('../hooks/data/useTitleData.ts', import.meta.url),
    'utf8'
  )
  const pageSource = await readFile(new URL('../app/title/[id].tsx', import.meta.url), 'utf8')
  assert.match(querySource, /titleDetailsQueryOptions/)
  assert.match(querySource, /mediaType:\s*type/)
  assert.match(querySource, /region:/)
  assert.match(querySource, /scope:/)
  assert.match(pageSource, /metaQuery\.isLoading/)
})

test('mobile home and search lists resolve locale before producing cards', async () => {
  const homeQueries = await readFile(new URL('../hooks/api/useTMDB.ts', import.meta.url), 'utf8')
  const search = await readFile(new URL('../hooks/ui/useSearch.ts', import.meta.url), 'utf8')
  assert.match(homeQueries, /queryKey:\s*TMDB_KEYS\.\w+\([^)]*language/)
  assert.match(homeQueries, /tmdbService\.setLanguage\(language\)/)
  assert.match(search, /useReadyLanguage/)
  assert.match(search, /tmdb\.setLanguage\(language\)/)
})
