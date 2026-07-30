import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('public web profiles render the Reviews row and include it in empty-state logic', async () => {
  const source = await readFile(new URL('../components/profile-view.tsx', import.meta.url), 'utf8')

  assert.match(source, /<ProfileReviewsSection/)
  assert.match(source, /username=\{profile\.username\}/)
  assert.match(source, /profileReviewsQuery\.data\?\.totalCount/)
  assert.match(source, /profileReviewsQuery\.isError/)
  assert.match(source, /<SeriesShelf[\s\S]*<ProfileReviewsSection[\s\S]*<PublicWatchlistShelf/)
})

test('profile review states distinguish initial pending and error from an empty success', async () => {
  const source = await readFile(
    new URL('../components/reviews/profile-reviews-section.tsx', import.meta.url),
    'utf8'
  )

  const pending = source.indexOf('query.isLoading && !query.data')
  const error = source.indexOf('query.isError && !query.data')
  const empty = source.indexOf('!query.data?.totalCount')

  assert.ok(pending >= 0, 'initial pending state must render review skeletons')
  assert.ok(error > pending, 'initial error state must follow the pending state')
  assert.ok(empty > error, 'only a settled empty result may hide the section')
  assert.match(source, /role="alert"/)
  assert.match(source, /reviews\.loadFailure/)
  assert.doesNotMatch(source, /query\.isError \|\| !query\.data\?\.totalCount/)
})

test('profile review refreshes retain cards and expose busy state without returning skeletons', async () => {
  const source = await readFile(
    new URL('../components/reviews/profile-reviews-section.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /aria-busy=\{query\.isFetching\}/)
  assert.match(source, /query\.isError \?/)
  assert.doesNotMatch(source, /if \(query\.isFetching\)/)
  assert.match(source, /query\.data\.items\.map/)
})
