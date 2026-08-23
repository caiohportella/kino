import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('title sidebar uses comfortable desktop typography', async () => {
  const source = await readFile(
    new URL('../../components/title/title-sidebar.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /text-base font-semibold text-kino-text/)
  assert.match(source, /h-10 w-10/)
})

test('embedded external services use comfortable sidebar sizing', async () => {
  const source = await readFile(
    new URL('../../components/external-links-section.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /flex h-11/)
  assert.match(source, /size-7/)
})

test('IMDb uses a valid local static logo asset', async () => {
  const source = await readFile(
    new URL('../../components/title/title-sidebar.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /iconUrl:\s*['"]\/external\/imdb\.svg['"]/)
})
