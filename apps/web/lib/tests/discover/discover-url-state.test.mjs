import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeDiscoverFilterState,
  readDiscoverUrlState,
  writeDiscoverCollectionUrl,
  writeDiscoverFilterUrl,
} from '../../discover/discover-url-state.ts'

function readParams(query) {
  return new URLSearchParams(query)
}

function toObject(params) {
  return Object.fromEntries(new URLSearchParams(params).entries())
}

const genres = [
  { id: 12, name: 'Adventure' },
  { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' },
]

test('reads a valid franchise collection with neutral filters', () => {
  const state = readDiscoverUrlState(
    readParams('collection=star-wars&type=movie&genres=18,12&rating=7&page=3'),
    genres
  )

  assert.equal(state.collection?.id, 'star-wars')

  assert.deepEqual(state.filters, {
    mediaType: 'all',
    genreIds: [],
    minRating: 0,
  })
})

test('invalid collection params fall back to normal Discover filters', () => {
  const state = readDiscoverUrlState(
    readParams('collection=not-real&type=movie&genres=27,999,12&rating=7'),
    genres
  )

  assert.equal(state.collection, null)

  assert.deepEqual(state.filters, {
    mediaType: 'movie',
    genreIds: [12, 27],
    minRating: 7,
  })
})

test('normal Discover reads and normalizes valid filter params', () => {
  const state = readDiscoverUrlState(readParams('type=movie&genres=18,12,18&rating=7'), genres)

  assert.equal(state.collection, null)

  assert.deepEqual(state.filters, {
    mediaType: 'movie',
    genreIds: [12, 18],
    minRating: 7,
  })
})

test('invalid media type falls back to all', () => {
  const state = readDiscoverUrlState(readParams('type=nope'), genres)

  assert.deepEqual(state.filters, {
    mediaType: 'all',
    genreIds: [],
    minRating: 0,
  })
})

test('unknown genres are discarded while valid genres are preserved', () => {
  const state = readDiscoverUrlState(readParams('genres=999,18,0,12'), genres)

  assert.deepEqual(state.filters.genreIds, [12, 18])
})

test('minimum rating is clamped to the supported range', () => {
  const aboveMaximum = readDiscoverUrlState(readParams('rating=15'), genres)

  const belowMinimum = readDiscoverUrlState(readParams('rating=-5'), genres)

  const invalid = readDiscoverUrlState(readParams('rating=whatever'), genres)

  assert.equal(aboveMaximum.filters.minRating, 10)
  assert.equal(belowMinimum.filters.minRating, 0)
  assert.equal(invalid.filters.minRating, 0)
})

test('normalizing filters deduplicates genres and clamps rating', () => {
  assert.deepEqual(
    normalizeDiscoverFilterState({
      mediaType: 'movie',
      genreIds: [27, 12, 27, -1, 0],
      minRating: 12,
    }),
    {
      mediaType: 'movie',
      genreIds: [12, 27],
      minRating: 10,
    }
  )
})

test('activating a collection exits filter mode and removes old pagination', () => {
  const next = writeDiscoverCollectionUrl(
    readParams('type=movie&genres=18,12&rating=7&page=4'),
    'star-wars'
  )

  assert.deepEqual(toObject(next), {
    collection: 'star-wars',
  })
})

test('switching collections replaces the active collection', () => {
  const next = writeDiscoverCollectionUrl(readParams('collection=star-wars'), 'mcu')

  assert.deepEqual(toObject(next), {
    collection: 'mcu',
  })
})

test('clearing a collection removes collection and stale pagination', () => {
  const next = writeDiscoverCollectionUrl(readParams('collection=star-wars&page=4'), null)

  assert.deepEqual(toObject(next), {})
})

test('clearing a collection does not delete unrelated URL params', () => {
  const next = writeDiscoverCollectionUrl(
    readParams('collection=star-wars&type=movie&rating=7&foo=bar&page=3'),
    null
  )

  assert.deepEqual(toObject(next), {
    type: 'movie',
    rating: '7',
    foo: 'bar',
  })
})

test('applying filters exits collection mode and removes old pagination', () => {
  const next = writeDiscoverFilterUrl(readParams('collection=star-wars&page=5'), {
    mediaType: 'movie',
    genreIds: [18, 12],
    minRating: 7,
  })

  assert.deepEqual(toObject(next), {
    type: 'movie',
    genres: '12,18',
    rating: '7',
  })
})

test('filter writes normalize duplicate genres and rating bounds', () => {
  const next = writeDiscoverFilterUrl(readParams('page=2'), {
    mediaType: 'tv',
    genreIds: [27, 12, 27],
    minRating: 15,
  })

  assert.deepEqual(toObject(next), {
    type: 'tv',
    genres: '12,27',
    rating: '10',
  })
})

test('neutral filters remove Discover filter params', () => {
  const next = writeDiscoverFilterUrl(readParams('type=movie&genres=12,18&rating=8&page=3'), {
    mediaType: 'all',
    genreIds: [],
    minRating: 0,
  })

  assert.deepEqual(toObject(next), {})
})

test('filter writes preserve unrelated URL params', () => {
  const next = writeDiscoverFilterUrl(readParams('collection=star-wars&page=4&foo=bar'), {
    mediaType: 'tv',
    genreIds: [27],
    minRating: 6,
  })

  assert.deepEqual(toObject(next), {
    foo: 'bar',
    type: 'tv',
    genres: '27',
    rating: '6',
  })
})

test('collection state round trips through the URL', () => {
  const query = writeDiscoverCollectionUrl(new URLSearchParams(), 'middle-earth')

  const state = readDiscoverUrlState(readParams(query), genres)

  assert.equal(state.collection?.id, 'middle-earth')

  assert.deepEqual(state.filters, {
    mediaType: 'all',
    genreIds: [],
    minRating: 0,
  })
})

test('filter state round trips through the URL', () => {
  const query = writeDiscoverFilterUrl(new URLSearchParams(), {
    mediaType: 'tv',
    genreIds: [27, 12],
    minRating: 8,
  })

  const state = readDiscoverUrlState(query, genres)

  assert.equal(state.collection, null)

  assert.deepEqual(state.filters, {
    mediaType: 'tv',
    genreIds: [12, 27],
    minRating: 8,
  })
})
