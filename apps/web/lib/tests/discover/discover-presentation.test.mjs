import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getVisibleDiscoverPersonalizedRails,
  mergePopularNow,
  resolveDiscoverPrimaryRow,
} from '../../discover/presentation.ts'

test('popular now mixes movies and series by popularity', () => {
  const movies = [
    { id: 1, media_type: 'movie', popularity: 80 },
    { id: 2, media_type: 'movie', popularity: 60 },
  ]

  const tv = [
    { id: 3, media_type: 'tv', popularity: 90 },
    { id: 4, media_type: 'tv', popularity: 70 },
  ]

  assert.deepEqual(
    mergePopularNow(movies, tv).map((item) => item.id),
    [3, 1, 4, 2]
  )
})

test('popular now removes duplicate media entries', () => {
  const movies = [
    { id: 1, media_type: 'movie', popularity: 80 },
    { id: 1, media_type: 'movie', popularity: 70 },
  ]

  assert.equal(mergePopularNow(movies, []).length, 1)
})

test('popular now respects its result limit', () => {
  const movies = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    media_type: 'movie',
    popularity: 100 - index,
  }))

  assert.equal(mergePopularNow(movies, [], 20).length, 20)
})

test('discover uses personalized recommendations when the row is strong enough', () => {
  const personalized = Array.from(
    { length: 8 },
    (_, index) => ({ id: index + 1 })
  )

  const popular = [{ id: 100 }]

  const result = resolveDiscoverPrimaryRow(
    personalized,
    popular
  )

  assert.equal(result.kind, 'for-you')
  assert.equal(result.items, personalized)
})

test('discover falls back to popular when personalization is too small', () => {
  const personalized = Array.from(
    { length: 7 },
    (_, index) => ({ id: index + 1 })
  )

  const popular = [{ id: 100 }]

  const result = resolveDiscoverPrimaryRow(
    personalized,
    popular
  )

  assert.equal(result.kind, 'popular')
  assert.equal(result.items, popular)
})

test('discover falls back to popular when personalization is empty', () => {
  const popular = [{ id: 100 }]

  const result = resolveDiscoverPrimaryRow([], popular)

  assert.equal(result.kind, 'popular')
  assert.equal(result.items, popular)
})

test('discover personalized rails preserve normalized order and cap output at two', () => {
  const rails = [
    {
      kind: 'because-you-liked',
      items: Array.from({ length: 8 }, (_, index) => ({ id: index + 1 })),
    },
    {
      kind: 'affinity',
      items: Array.from({ length: 6 }, (_, index) => ({ id: index + 20 })),
      source: { id: 72 },
    },
    {
      kind: 'affinity',
      items: Array.from({ length: 6 }, (_, index) => ({ id: index + 40 })),
      source: { id: 88 },
    },
  ]

  const result = getVisibleDiscoverPersonalizedRails(rails)

  assert.equal(result.length, 2)
  assert.equal(result[0], rails[0])
  assert.equal(result[1], rails[1])
})

test('discover personalized rails omit empty rails so the section can disappear cleanly', () => {
  const result = getVisibleDiscoverPersonalizedRails([
    {
      kind: 'because-you-liked',
      items: [],
    },
    {
      kind: 'affinity',
      items: [],
      source: { id: 72 },
    },
  ])

  assert.deepEqual(result, [])
})
