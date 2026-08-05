import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('public web profiles render the Reviews row in the expected shelf order', async () => {
  const source = await readFile(new URL('../components/profile-view.tsx', import.meta.url), 'utf8')

  assert.match(source, /<ProfileReviewsSection/)
  assert.match(source, /username=\{profile\.username\}/)
  assert.match(source, /<SeriesShelf[\s\S]*<ProfileReviewsSection[\s\S]*<PublicWatchlistShelf/)
})
