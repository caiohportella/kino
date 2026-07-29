import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { searchQueryKeys } from '@kino/core/cache'

test('mobile semantic hook uses shared contracts, canonical keys, cancellation, and configured gateway', async () => {
  const source = await readFile(
    new URL('../hooks/api/useUpstashSearch.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /SEARCH_SCHEMA_VERSION/)
  assert.match(source, /searchQueryKeys\.results/)
  assert.match(source, /mediaTypes/)
  assert.match(source, /mode/)
  assert.match(source, /resolveKinoApiOrigin/)
  assert.match(source, /signal/)
  assert.doesNotMatch(source, /services\/upstash/)
})

test('semantic cache identities isolate mode and media type before pagination', () => {
  const base = {
    locale: 'en',
    page: 1,
    query: 'brando',
    region: 'US',
    scope: { kind: 'public' },
  }
  const autocomplete = searchQueryKeys.results({
    ...base,
    filters: { limit: 5, mediaTypes: '', mode: 'autocomplete' },
  })
  const movies = searchQueryKeys.results({
    ...base,
    filters: { limit: 20, mediaTypes: 'movie', mode: 'full' },
  })
  assert.notDeepEqual(autocomplete, movies)
})

test('mobile search renders one gateway result stream and leaves TMDB fallback server-side', async () => {
  const source = await readFile(new URL('../app/(tabs)/search.tsx', import.meta.url), 'utf8')
  assert.match(source, /useUpstashSearch/)
  assert.doesNotMatch(source, /tmdbSearch|tmdbResults|useSearch/)
  assert.match(source, /movies/)
  assert.match(source, /series/)
  assert.match(source, /people/)
  assert.match(source, /users/)
  assert.doesNotMatch(source, /activeResults = rawResults\.filter/)
  assert.match(source, /mode=\{submittedQuery \? 'full' : 'autocomplete'\}/)
  assert.match(source, /mode === 'full' && nextPage/)
  assert.match(source, /resetDiscoveryOnlyFilters/)
})
