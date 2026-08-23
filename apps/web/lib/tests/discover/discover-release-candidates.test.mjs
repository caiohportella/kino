import assert from 'node:assert/strict'
import test from 'node:test'

import { selectRecentRelatedReleases } from '../../discover/release-candidates.ts'

function movie(id, releaseDate) {
  return {
    id,
    media_type: 'movie',
    release_date: releaseDate,
  }
}

function tv(id, firstAirDate) {
  return {
    id,
    media_type: 'tv',
    first_air_date: firstAirDate,
  }
}

test('keeps related movies inside the current release window', () => {
  const result = selectRecentRelatedReleases([movie(1, '2026-07-10'), movie(2, '2026-08-15')], {
    start: '2026-07-08',
    end: '2026-08-21',
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2]
  )
})

test('keeps related tv releases inside the current release window', () => {
  const result = selectRecentRelatedReleases([tv(1, '2026-08-01'), tv(2, '2026-08-20')], {
    start: '2026-07-08',
    end: '2026-08-21',
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2]
  )
})

test('excludes titles released before the recent window', () => {
  const result = selectRecentRelatedReleases([movie(1, '2025-12-01'), movie(2, '2026-08-10')], {
    start: '2026-07-08',
    end: '2026-08-21',
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [2]
  )
})

test('excludes future titles from new releases', () => {
  const result = selectRecentRelatedReleases([movie(1, '2026-08-22'), movie(2, '2026-08-20')], {
    start: '2026-07-08',
    end: '2026-08-21',
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [2]
  )
})

test('excludes titles with missing or invalid release dates', () => {
  const result = selectRecentRelatedReleases(
    [movie(1, ''), movie(2), tv(3, undefined), movie(4, 'not-a-date'), movie(5, '2026-08-20')],
    {
      start: '2026-07-08',
      end: '2026-08-21',
    }
  )

  assert.deepEqual(
    result.map((item) => item.id),
    [5]
  )
})

test('preserves the source order of eligible titles', () => {
  const result = selectRecentRelatedReleases(
    [movie(3, '2026-08-20'), movie(1, '2026-07-10'), movie(2, '2026-08-01')],
    {
      start: '2026-07-08',
      end: '2026-08-21',
    }
  )

  assert.deepEqual(
    result.map((item) => item.id),
    [3, 1, 2]
  )
})
