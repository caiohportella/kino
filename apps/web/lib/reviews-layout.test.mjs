import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('title reviews render as a vertical editorial list', async () => {
  const source = await readFile(
    new URL('../components/reviews/reviews-section.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /reviews\.map\(renderReview\)/)
  assert.match(source, /border-t border-white\/10/)

  assert.doesNotMatch(
    source,
    /ReviewsCarousel/,
    'title reviews should no longer use the horizontal carousel'
  )
})
