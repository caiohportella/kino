import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('web search requests V2, uses normalized presentation, and preserves gateway pagination', async () => {
  const source = await readFile(new URL('../../app/search/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /createSearchGatewayClient/)
  assert.match(source, /SEARCH_SCHEMA_VERSION_V2/)
  assert.match(source, /toWebSearchGroups/)
  assert.match(source, /searchQueryKeys\.results/)
  assert.match(source, /signal/)
  assert.match(source, /nextPage/)
  assert.match(source, /mode/)
  assert.match(source, /AUTOCOMPLETE_LIMIT/)
  assert.match(source, /movies/)
  assert.match(source, /series/)
  assert.match(source, /resetDiscoveryOnlyFilters/)
  assert.doesNotMatch(source, /tmdb\.search\(|tmdb\.searchPeople\(|db\.searchUsers\(/)
  assert.doesNotMatch(source, /vote_average:\s*result\.score/)
})

test('web search uses a non-executable root cache key while the query is empty', async () => {
  const source = await readFile(new URL('../../app/search/page.tsx', import.meta.url), 'utf8')
  assert.match(
    source,
    /queryKey:\s*searching\s*\?\s*searchQueryKeys\.results\([\s\S]*?\)\s*:\s*searchQueryKeys\.resultsRoot\(\)/
  )
})
