import assert from 'node:assert/strict'
import test from 'node:test'

import {
  selectActorSeriesCredits,
  selectCreatorSeriesCredits,
  selectDirectedDiscoverResults,
} from '../../discover/related-release-sources.ts'

function movie(id) {
  return {
    id,
    media_type: 'movie',
  }
}

test('keeps discover titles where the person was the director', () => {
  const result = selectDirectedDiscoverResults(
    [movie(1), movie(2), movie(3)],
    [
      {
        ...movie(1),
        job: 'Director',
      },
      {
        ...movie(2),
        job: 'Producer',
      },
      {
        ...movie(3),
        job: 'Director',
      },
    ]
  )

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 3]
  )
})

test('accepts creator credits for tv-oriented affinity', () => {
  const result = selectDirectedDiscoverResults(
    [
      {
        id: 10,
        media_type: 'tv',
      },
    ],
    [
      {
        id: 10,
        media_type: 'tv',
        job: 'Creator',
      },
    ]
  )

  assert.deepEqual(
    result.map((item) => item.id),
    [10]
  )
})

test('matches by media type as well as numeric id', () => {
  const result = selectDirectedDiscoverResults(
    [
      {
        id: 10,
        media_type: 'movie',
      },
      {
        id: 10,
        media_type: 'tv',
      },
    ],
    [
      {
        id: 10,
        media_type: 'tv',
        job: 'Creator',
      },
    ]
  )

  assert.deepEqual(
    result.map((item) => `${item.media_type}:${item.id}`),
    ['tv:10']
  )
})

test('keeps creator credits for tv releases', () => {
  const result = selectDirectedDiscoverResults(
    [
      {
        id: 10,
        media_type: 'tv',
      },
      {
        id: 20,
        media_type: 'tv',
      },
    ],
    [
      {
        id: 10,
        media_type: 'tv',
        job: 'Creator',
      },
      {
        id: 20,
        media_type: 'tv',
        job: 'Producer',
      },
    ]
  )

  assert.deepEqual(
    result.map((item) => item.id),
    [10]
  )
})

test('selects recent tv cast credits for actor series affinity', () => {
  const result = selectActorSeriesCredits([
    {
      id: 10,
      media_type: 'tv',
      first_air_date: '2026-08-15',
      credit_id: 'a',
    },
    {
      id: 20,
      media_type: 'movie',
      release_date: '2026-08-15',
      credit_id: 'b',
    },
  ])

  assert.deepEqual(
    result.map((item) => item.id),
    [10]
  )
})

test('selects tv creator and director credits only', () => {
  const result = selectCreatorSeriesCredits([
    {
      id: 10,
      media_type: 'tv',
      first_air_date: '2026-08-15',
      job: 'Creator',
      credit_id: 'a',
    },
    {
      id: 20,
      media_type: 'tv',
      first_air_date: '2026-08-16',
      job: 'Director',
      credit_id: 'b',
    },
    {
      id: 30,
      media_type: 'tv',
      first_air_date: '2026-08-17',
      job: 'Producer',
      credit_id: 'c',
    },
    {
      id: 40,
      media_type: 'movie',
      release_date: '2026-08-18',
      job: 'Director',
      credit_id: 'd',
    },
  ])

  assert.deepEqual(
    result.map((item) => item.id),
    [10, 20]
  )
})
