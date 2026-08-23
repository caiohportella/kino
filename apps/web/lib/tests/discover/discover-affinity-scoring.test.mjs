import assert from 'node:assert/strict'
import test from 'node:test'

import { selectDiscoverAffinities } from '../../discover/affinity-scoring.ts'

let titleSequence = 0

function title(overrides = {}) {
  titleSequence += 1

  return {
    titleId: `title-${titleSequence}`,
    rating: 5,
    cast: [],
    director: null,
    ...overrides,
  }
}

test('affinity requires at least two distinct liked titles', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      cast: [
        {
          id: 10,
          name: 'Actor A',
          order: 0,
        },
      ],
    }),
  ])

  assert.deepEqual(result.actors, [])
})

test('repeated actor across liked titles becomes an affinity', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 5,
      cast: [
        {
          id: 10,
          name: 'Actor A',
          order: 0,
        },
      ],
    }),
    title({
      titleId: 'b',
      rating: 4.5,
      cast: [
        {
          id: 10,
          name: 'Actor A',
          order: 1,
        },
      ],
    }),
  ])

  assert.equal(result.actors[0]?.id, 10)
  assert.equal(result.actors[0]?.titleCount, 2)
})

test('ratings below four stars do not contribute to affinity', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 5,
      cast: [
        {
          id: 10,
          name: 'Actor A',
          order: 0,
        },
      ],
    }),
    title({
      titleId: 'b',
      rating: 3.5,
      cast: [
        {
          id: 10,
          name: 'Actor A',
          order: 0,
        },
      ],
    }),
  ])

  assert.deepEqual(result.actors, [])
})

test('leading cast receives more affinity weight than minor cast', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 5,
      cast: [
        {
          id: 10,
          name: 'Lead',
          order: 0,
        },
        {
          id: 20,
          name: 'Minor',
          order: 12,
        },
      ],
    }),
    title({
      titleId: 'b',
      rating: 5,
      cast: [
        {
          id: 10,
          name: 'Lead',
          order: 1,
        },
        {
          id: 20,
          name: 'Minor',
          order: 12,
        },
      ],
    }),
  ])

  const minor = result.actors.find((person) => person.id === 20)

  assert.equal(result.actors[0]?.id, 10)
  assert.ok(minor)
  assert.ok(result.actors[0].score > minor.score)
})

test('repeated director becomes a director affinity', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 5,
      director: {
        id: 30,
        name: 'Director A',
      },
    }),
    title({
      titleId: 'b',
      rating: 4.5,
      director: {
        id: 30,
        name: 'Director A',
      },
    }),
  ])

  assert.equal(result.directors[0]?.id, 30)
  assert.equal(result.directors[0]?.titleCount, 2)
})

test('duplicate observations of the same title count only once', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 5,
      cast: [
        {
          id: 10,
          name: 'Actor A',
          order: 0,
        },
      ],
    }),
    title({
      titleId: 'a',
      rating: 4.5,
      cast: [
        {
          id: 10,
          name: 'Actor A',
          order: 0,
        },
      ],
    }),
  ])

  assert.deepEqual(result.actors, [])
})

test('director affinity favors stronger ratings over a small title-count advantage', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a-1',
      rating: 4.1,
      director: {
        id: 10,
        name: 'More Titles Director',
      },
    }),
    title({
      titleId: 'a-2',
      rating: 4.1,
      director: {
        id: 10,
        name: 'More Titles Director',
      },
    }),
    title({
      titleId: 'a-3',
      rating: 4.1,
      director: {
        id: 10,
        name: 'More Titles Director',
      },
    }),

    title({
      titleId: 'b-1',
      rating: 5,
      director: {
        id: 20,
        name: 'Stronger Ratings Director',
      },
    }),
    title({
      titleId: 'b-2',
      rating: 5,
      director: {
        id: 20,
        name: 'Stronger Ratings Director',
      },
    }),
  ])

  assert.equal(result.directors[0]?.id, 20)
})

test('director affinity rewards repeated strong evidence once ratings are close', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a-1',
      rating: 5,
      director: {
        id: 10,
        name: 'Two Perfect Titles',
      },
    }),
    title({
      titleId: 'a-2',
      rating: 5,
      director: {
        id: 10,
        name: 'Two Perfect Titles',
      },
    }),

    ...Array.from({ length: 5 }, (_, index) =>
      title({
        titleId: `b-${index}`,
        rating: 4.7,
        director: {
          id: 20,
          name: 'Many Strong Titles',
        },
      })
    ),
  ])

  assert.equal(result.directors[0]?.id, 20)
})

test('single-title directors remain candidates but repeated strong evidence wins', () => {
  const result = selectDiscoverAffinities(
    [
      title({
        titleId: 'single',
        rating: 5,
        director: {
          id: 10,
          name: 'Single Perfect Film',
        },
      }),

      title({
        titleId: 'repeated-1',
        rating: 4.7,
        director: {
          id: 20,
          name: 'Repeated Strong Director',
        },
      }),

      title({
        titleId: 'repeated-2',
        rating: 4.7,
        director: {
          id: 20,
          name: 'Repeated Strong Director',
        },
      }),

      title({
        titleId: 'repeated-3',
        rating: 4.7,
        director: {
          id: 20,
          name: 'Repeated Strong Director',
        },
      }),
    ],
    3
  )

  assert.equal(
    result.directors.some((director) => director.id === 10),
    true
  )

  assert.equal(result.directors[0]?.id, 20)
})

test('studio affinity requires repeated liked titles', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 5,
      studios: [
        {
          id: 100,
          name: 'Studio A',
        },
      ],
    }),
  ])

  assert.deepEqual(result.studios, [])
})

test('repeated studio becomes a studio affinity', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 4.8,
      studios: [
        {
          id: 100,
          name: 'Studio A',
        },
      ],
    }),
    title({
      titleId: 'b',
      rating: 4.6,
      studios: [
        {
          id: 100,
          name: 'Studio A',
        },
      ],
    }),
  ])

  assert.equal(result.studios[0]?.id, 100)
  assert.equal(result.studios[0]?.titleCount, 2)
})

test('studio affinity favors rating quality over raw volume', () => {
  const result = selectDiscoverAffinities([
    ...Array.from({ length: 6 }, (_, index) =>
      title({
        titleId: `volume-${index}`,
        rating: 4,
        studios: [
          {
            id: 100,
            name: 'Volume Studio',
          },
        ],
      })
    ),

    ...Array.from({ length: 3 }, (_, index) =>
      title({
        titleId: `quality-${index}`,
        rating: 4.7,
        studios: [
          {
            id: 200,
            name: 'Quality Studio',
          },
        ],
      })
    ),
  ])

  assert.equal(result.studios[0]?.id, 200)
})

test('same studio only counts once per title', () => {
  const result = selectDiscoverAffinities([
    title({
      titleId: 'a',
      rating: 5,
      studios: [
        {
          id: 100,
          name: 'Studio A',
        },
        {
          id: 100,
          name: 'Studio A',
        },
      ],
    }),
  ])

  assert.deepEqual(result.studios, [])
})
