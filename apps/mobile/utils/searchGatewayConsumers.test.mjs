import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('mobile semantic hook uses shared contracts, canonical keys, cancellation, and configured gateway', async () => {
  const source = await readFile(
    new URL('../hooks/api/useUpstashSearch.ts', import.meta.url),
    'utf8'
  )
  assert.match(source, /SEARCH_SCHEMA_VERSION/)
  assert.match(source, /searchQueryKeys\.results/)
  assert.match(source, /resolveKinoApiOrigin/)
  assert.match(source, /signal/)
  assert.doesNotMatch(source, /services\/upstash/)
})

test('mobile search renders one gateway result stream and leaves TMDB fallback server-side', async () => {
  const source = await readFile(new URL('../app/(tabs)/search.tsx', import.meta.url), 'utf8')
  assert.match(source, /useUpstashSearch/)
  assert.doesNotMatch(source, /tmdbSearch|tmdbResults|useSearch/)
})
