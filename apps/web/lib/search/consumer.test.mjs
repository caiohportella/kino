import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('web search uses the v1 gateway, canonical locale cache key, cancellation, and pagination', async () => {
  const source = await readFile(new URL('../../app/search/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /createSearchGatewayClient/)
  assert.match(source, /SEARCH_SCHEMA_VERSION/)
  assert.match(source, /searchQueryKeys\.results/)
  assert.match(source, /signal/)
  assert.match(source, /nextPage/)
  assert.match(source, /mode/)
  assert.match(source, /AUTOCOMPLETE_LIMIT/)
  assert.match(source, /movies/)
  assert.match(source, /series/)
  assert.match(source, /resetDiscoveryOnlyFilters/)
  assert.doesNotMatch(source, /tmdb\.search\(|tmdb\.searchPeople\(|db\.searchUsers\(/)
})

test('web search uses a non-executable root cache key while the query is empty', async () => {
  const source = await readFile(new URL('../../app/search/page.tsx', import.meta.url), 'utf8')
  assert.match(
    source,
    /queryKey:\s*searching\s*\?\s*searchQueryKeys\.results\([\s\S]*?\)\s*:\s*searchQueryKeys\.resultsRoot\(\)/
  )
})
