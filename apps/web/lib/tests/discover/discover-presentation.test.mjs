import assert from 'node:assert/strict'
import test from 'node:test'

import { mergePopularNow } from '../../discover/presentation.ts'

test('popular now interleaves movies and series while preserving source order', () => {
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
    [1, 3, 2, 4]
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
