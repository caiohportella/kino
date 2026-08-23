import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('title synopsis no longer owns the personal rating controls', async () => {
  const source = await readFile(
    new URL('../../components/title/title-metadata.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function TitleSynopsis/)
  assert.doesNotMatch(source, /export function TitleSynopsisAndRating/)
})

test('movie ratings panel gives the interactive control room before three-column desktop layout', async () => {
  const source = await readFile(
    new URL('../../components/title/title-metadata.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /grid-cols-1[\s\S]*sm:grid-cols-2/)
  assert.match(
    source,
    /type === ['"]movie['"][\s\S]*?lg:grid-cols-4/,
    'movie ratings should use a four-column desktop grid'
  )

  assert.match(
    source,
    /sm:col-span-2/,
    'the interactive movie rating control should occupy half of the desktop ratings row'
  )
  assert.match(
    source,
    /sm:col-span-2/,
    'the interactive movie rating control should span two columns'
  )
  assert.match(source, /<RatingStars[\s\S]*className="shrink-0"/)
  assert.match(source, /border-b[\s\S]*sm:border-b-0/)
  assert.match(source, /currentUserRating/)
  assert.match(source, /RatingStars/)
})
