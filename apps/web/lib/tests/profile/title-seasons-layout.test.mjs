import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('episode watch action stays right-aligned when rating stars are absent', async () => {
  const source = await readFile(
    new URL('../../../components/title/title-seasons.tsx', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /<div className="flex w-full items-center justify-end gap-2 md:min-w-48/,
    'the episode action area should pin the eye control to the right edge'
  )
  assert.match(
    source,
    /className="mr-auto rounded-md p-1[^\"]*"/,
    'rating stars should remain on the left when they are rendered alongside the eye control'
  )
  assert.match(source, /onAuthRequiredAction/)
})
