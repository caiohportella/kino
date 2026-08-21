import assert from 'node:assert/strict'
import test from 'node:test'

function readParams(query) {
  return new URLSearchParams(query)
}

function toObject(query) {
  return Object.fromEntries(new URLSearchParams(query).entries())
}

const genres = [
  { id: 12, name: 'Adventure' },
  { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' },
]

test('reads a valid collection and filters from URL params', async () => {
  const { readDiscoverUrlState } = await import('../../discover/discover-url-state.ts')

  const state = readDiscoverUrlState(
    readParams('collection=hidden-gems&type=movie&genres=18,999,12&rating=7&page=3'),
    genres,
  )

  assert.equal(state.collection?.id, 'hidden-gems')
  assert.deepEqual(state.filters, {
    mediaType: 'movie',
    genreIds: [18, 12],
    minRating: 7,
  })
  assert.equal(state.page, 3)
})

test('invalid collection params resolve to normal Discover', async () => {
  const { readDiscoverUrlState } = await import('../../discover/discover-url-state.ts')

  const state = readDiscoverUrlState(
    readParams('collection=not-real&type=nope&genres=27,0&rating=15&page=-2'),
    genres,
  )

  assert.equal(state.collection, null)
  assert.deepEqual(state.filters, {
    mediaType: 'all',
    genreIds: [27],
    minRating: 0,
  })
  assert.equal(state.page, 1)
})

test('normal Discover preserves valid filter params without a collection', async () => {
  const { readDiscoverUrlState } = await import('../../discover/discover-url-state.ts')

  const state = readDiscoverUrlState(
    readParams('type=movie&genres=18&rating=7&page=2'),
    genres,
  )

  assert.equal(state.collection, null)
  assert.deepEqual(state.filters, {
    mediaType: 'movie',
    genreIds: [18],
    minRating: 7,
  })
  assert.equal(state.page, 2)
})

test('clearing collection preserves unrelated filters', async () => {
  const { writeDiscoverCollectionUrl } = await import('../../discover/discover-url-state.ts')

  const next = writeDiscoverCollectionUrl(
    readParams('collection=hidden-gems&type=movie&rating=7'),
    null,
  )

  assert.deepEqual(toObject(next), {
    type: 'movie',
    rating: '7',
  })
})

test('activating collection clears stale page and genre state', async () => {
  const { writeDiscoverCollectionUrl } = await import('../../discover/discover-url-state.ts')

  const next = writeDiscoverCollectionUrl(
    readParams('type=tv&genres=10759&page=4&rating=7'),
    'quick-watch',
  )

  assert.deepEqual(toObject(next), {
    collection: 'quick-watch',
    rating: '7',
  })
})

test('filter writes preserve collection and reset page', async () => {
  const {
    writeDiscoverFilterUrl,
    readDiscoverUrlState,
  } = await import('../../discover/discover-url-state.ts')
  const { parseDiscoverCollection } = await import('../../discover/collections.ts')

  const collection = parseDiscoverCollection('hidden-gems')
  const next = writeDiscoverFilterUrl(
    readParams('collection=hidden-gems&page=5'),
    {
      mediaType: 'movie',
      genreIds: [18, 12],
      minRating: 7,
    },
    collection,
  )

  assert.deepEqual(toObject(next), {
    collection: 'hidden-gems',
    type: 'movie',
    genres: '18,12',
    rating: '7',
  })

  const roundTrip = readDiscoverUrlState(readParams(next), genres)

  assert.equal(roundTrip.collection?.id, 'hidden-gems')
  assert.deepEqual(roundTrip.filters, {
    mediaType: 'movie',
    genreIds: [18, 12],
    minRating: 7,
  })
  assert.equal(roundTrip.page, 1)
})

test('filter writes remove Quick Watch TV media type while preserving rating', async () => {
  const { writeDiscoverFilterUrl } = await import('../../discover/discover-url-state.ts')
  const { parseDiscoverCollection } = await import('../../discover/collections.ts')

  const collection = parseDiscoverCollection('quick-watch')
  const next = writeDiscoverFilterUrl(
    readParams('collection=quick-watch&page=3&rating=7'),
    {
      mediaType: 'tv',
      genreIds: [],
      minRating: 8,
    },
    collection,
  )

  assert.deepEqual(toObject(next), {
    collection: 'quick-watch',
    rating: '8',
  })
})

test('Quick Watch TV filter changes normalize before building live requests', async () => {
  const { normalizeDiscoverFilterState } = await import('../../discover/discover-url-state.ts')
  const { mergeDiscoverCriteria, parseDiscoverCollection } = await import('../../discover/collections.ts')

  const collection = parseDiscoverCollection('quick-watch')
  const filters = normalizeDiscoverFilterState(
    {
      mediaType: 'tv',
      genreIds: [],
      minRating: 8,
    },
    collection,
  )
  const criteria = mergeDiscoverCriteria({
    collection,
    filters,
    page: 1,
  })

  assert.deepEqual(filters, {
    mediaType: 'all',
    genreIds: [],
    minRating: 8,
  })
  assert.equal(criteria.requests.length, 1)
  assert.equal(criteria.requests[0].type, 'movie')
  assert.equal(criteria.requests[0].params['vote_average.gte'], '8')
})
