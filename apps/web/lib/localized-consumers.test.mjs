import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('web media cards keep the locale-ready list source stable and hydrate summary cache', async () => {
  const source = await readFile(new URL('../components/media-card.tsx', import.meta.url), 'utf8')
  assert.match(source, /seedTitleSummary/)
  assert.match(source, /prefetchTitleSummary/)
  assert.match(source, /onMouseEnter/)
  assert.match(source, /onFocus/)
  assert.match(source, /onTouchStart/)
  assert.doesNotMatch(source, /useLocalizedTitles/)
})

test('web Discover resolves request language before loading localized server data', async () => {
  const source = await readFile(new URL('../app/discover/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /getRequestLanguage/)
  assert.match(source, /getTranslations/)
  assert.match(source, /getDiscoverData\(language\)/)
  assert.doesNotMatch(source, /localeStatus/)
  assert.doesNotMatch(source, /useQuery/)
})

test('web Search waits for locale readiness before enabling TMDB queries', async () => {
  const source = await readFile(new URL('../app/search/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /localeStatus/)
  assert.match(source, /enabled:/)
})

test('web diary waits for all localized summaries before showing title presentation', async () => {
  const source = await readFile(new URL('../app/diary/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /localizedTitles\.isPending/)
})

test('web profile rows wait for localized summaries rather than swapping fallback posters', async () => {
  const source = await readFile(new URL('../components/profile-view.tsx', import.meta.url), 'utf8')
  assert.match(source, /localizedTitles\.isPending/)
  assert.doesNotMatch(source, /localized\?\.posterPath\s*\?\?\s*(?:movie|series|item)\.cover_image/)
})

test('web missing or rejected localization uses Kino presentation fallbacks only', async () => {
  const diary = await readFile(new URL('../app/diary/page.tsx', import.meta.url), 'utf8')
  const profile = await readFile(new URL('../components/profile-view.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(diary, /localized\?\.posterPath\s*\?\?\s*entry\.coverImage/)
  assert.match(diary, /localized\?\.posterPath\s*\?\?\s*null/)
  assert.doesNotMatch(profile, /localized\?\.posterPath\s*\?\?\s*\w+\.cover_image/)
  assert.match(profile, /localized\?\.posterPath\s*\?\?\s*null/)
})

test('web localized list hydration never fans out into per-card TMDB detail requests', async () => {
  const source = await readFile(new URL('./use-localized-titles.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /getMovieDetails|getTVDetails/)
  assert.match(source, /hydrateLocalizedTitleBatch/)
  assert.match(source, /queryKey:\s*\[\s*'localized-title-batch'/)
})

test('web title detail query consumes canonical options and its compatible summary placeholder', async () => {
  const source = await readFile(new URL('../app/title/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /titleDetailsQueryOptions/)
  assert.match(source, /mediaType:\s*type/)
  assert.match(source, /region:/)
  assert.match(source, /scope:/)
  assert.match(source, /titleQuery\.isLoading/)
  assert.match(source, /summary\.posterPath/)
  assert.match(source, /summary\.title/)
})

test('web media rows delegate every title intent to the canonical MediaCard boundary', async () => {
  const section = await readFile(
    new URL('../components/media-section.tsx', import.meta.url),
    'utf8'
  )
  const row = await readFile(new URL('../components/media-row.tsx', import.meta.url), 'utf8')
  assert.match(section, /<MediaCard/)
  assert.doesNotMatch(row, /poster|titleQuery|localized/i)
})
