import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const selectorUrl = new URL('../../discover/personalized-rows.ts', import.meta.url)

const clientUrl = new URL('../../../components/discover/discover-client.tsx', import.meta.url)

test('discover personalization allows up to five selected rows', async () => {
  const source = await readFile(selectorUrl, 'utf8')

  assert.match(
    source,
    /const MAX_SELECTED_ROWS = 5/,
    'personalization should allow up to five visible rows'
  )
})

test('personalization reserves viable genre and studio candidates', async () => {
  const source = await readFile(selectorUrl, 'utf8')

  assert.match(
    source,
    /RESERVED_PERSONALIZED_KINDS[\s\S]*['"]genre['"][\s\S]*['"]studio['"]/,
    'genre and studio should receive reserved slots when viable'
  )
})

test('discover renders the full personalized row collection', async () => {
  const source = await readFile(clientUrl, 'utf8')

  assert.doesNotMatch(
    source,
    /const \[primaryPersonalizedRow,\s*secondaryPersonalizedRow\] = personalized\.rows/,
    'discover should not reduce personalization to two rows'
  )

  assert.match(
    source,
    /personalized\.rows\.slice\(0,\s*2\)\.map/,
    'discover should render the first personalized rows before collections'
  )

  assert.match(
    source,
    /personalized\.rows\.slice\(2\)\.map/,
    'discover should render the remaining personalized rows after collections'
  )
})
