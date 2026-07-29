import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('web media cards keep the locale-ready list source stable and hydrate summary cache', async () => {
  const source = await readFile(new URL('../components/media-card.tsx', import.meta.url), 'utf8')
  assert.match(source, /seedTitleSummary/)
  assert.match(source, /onMouseEnter/)
  assert.doesNotMatch(source, /useLocalizedTitles/)
})

for (const relativePath of ['../app/discover/page.tsx', '../app/search/page.tsx']) {
  test(`${relativePath} waits for locale readiness before enabling TMDB queries`, async () => {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.match(source, /localeStatus/)
    assert.match(source, /enabled:/)
  })
}

test('web diary waits for all localized summaries before showing title presentation', async () => {
  const source = await readFile(new URL('../app/diary/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /localizedTitles\.isPending/)
})

test('web profile rows wait for localized summaries rather than swapping fallback posters', async () => {
  const source = await readFile(new URL('../components/profile-view.tsx', import.meta.url), 'utf8')
  assert.match(source, /localizedTitles\.isPending/)
})

test('web title detail query is locale-keyed and skeleton-gated', async () => {
  const source = await readFile(new URL('../app/title/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /\['title-metadata',\s*tmdbId,\s*type,\s*language\]/)
  assert.match(source, /titleQuery\.isLoading/)
})
