import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const profileReviewState = await import('./profile-review-query-state.ts').catch(() => null)
const profileSource = await readFile(
  new URL('../components/profile-view.tsx', import.meta.url),
  'utf8'
)
const sectionSource = await readFile(
  new URL('../components/reviews/profile-reviews-section.tsx', import.meta.url),
  'utf8'
)

const cachedEmpty = { items: [], totalCount: 0 }
const cachedNonempty = {
  items: [{ id: 'review-1' }, { id: 'review-2' }],
  totalCount: 2,
}

const queryStateCases = [
  {
    name: 'fetching initial pending',
    query: { data: undefined, fetchStatus: 'fetching', status: 'pending' },
    wantKind: 'pending',
  },
  {
    name: 'paused initial pending',
    query: { data: undefined, fetchStatus: 'paused', status: 'pending' },
    wantKind: 'pending',
  },
  {
    name: 'initial error',
    query: { data: undefined, fetchStatus: 'idle', status: 'error' },
    wantKind: 'error',
  },
  {
    name: 'successful empty',
    query: { data: cachedEmpty, fetchStatus: 'idle', status: 'success' },
    wantKind: 'empty',
  },
  {
    name: 'retained nonempty refresh',
    query: { data: cachedNonempty, fetchStatus: 'fetching', status: 'success' },
    wantData: cachedNonempty,
    wantKind: 'content',
  },
  {
    name: 'retained nonempty refetch error',
    query: { data: cachedNonempty, fetchStatus: 'idle', status: 'error' },
    wantData: cachedNonempty,
    wantKind: 'content',
  },
  {
    name: 'retained empty refetch error',
    query: { data: cachedEmpty, fetchStatus: 'idle', status: 'error' },
    wantData: cachedEmpty,
    wantKind: 'content',
  },
]

for (const { name, query, wantData, wantKind } of queryStateCases) {
  test(`profile review query state: ${name}`, () => {
    const resolveProfileReviewsQueryState = profileReviewState?.resolveProfileReviewsQueryState
    assert.equal(
      typeof resolveProfileReviewsQueryState,
      'function',
      'the shared profile-review query-state resolver must exist'
    )

    const state = resolveProfileReviewsQueryState(query)
    assert.equal(state.kind, wantKind)
    if (wantData) assert.strictEqual(state.data, wantData)
  })
}

test('public web profiles render the Reviews row and use only known-empty review data', () => {
  assert.match(profileSource, /<ProfileReviewsSection/)
  assert.match(profileSource, /username=\{profile\.username\}/)
  assert.match(profileSource, /toSliceState\([\s\S]*sections\.reviews/)
  assert.match(
    profileSource,
    /isProfileKnownEmpty\(\[moviesState, seriesState, watchlistsState, reviewsState\]\)/
  )
  assert.doesNotMatch(profileSource, /profileReviewsQuery\.isLoading/)
  assert.doesNotMatch(profileSource, /!profileReviewsQuery\.data\?\.totalCount/)
  assert.match(
    profileSource,
    /<SeriesShelf[\s\S]*<ProfileReviewsSection[\s\S]*<PublicWatchlistShelf/
  )
})

test('profile review section distinguishes initial states from retained-data states', () => {
  assert.match(sectionSource, /if \(query\.isLoading && !query\.data\) return null/)
  assert.match(sectionSource, /if \(query\.isError && !query\.data\)/)
  assert.match(sectionSource, /if \(!query\.data\?\.totalCount\) return null/)
  assert.match(sectionSource, /role="alert"/)
  assert.match(sectionSource, /reviews\.loadFailure/)
  assert.doesNotMatch(sectionSource, /ProfileReviewSkeleton/)
  assert.doesNotMatch(sectionSource, /resolveProfileReviewsQueryState\(query\)/)
})

test('profile review refreshes retain cards and expose busy/error state', () => {
  assert.match(sectionSource, /aria-busy=\{query\.isFetching\}/)
  assert.match(sectionSource, /query\.isError \?/)
  assert.doesNotMatch(sectionSource, /if \(query\.isFetching\)/)
  assert.match(sectionSource, /query\.data\.items\.map/)
})
