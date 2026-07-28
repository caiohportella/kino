import assert from 'node:assert/strict'
import test from 'node:test'
import { expandPersonCredits } from './person-expansion.ts'

const person = {
  source: 'person',
  entity: {
    id: 'person:3084',
    entityType: 'person',
    title: 'Marlon Brando',
    tmdbId: 3084,
  },
  confidence: 0.97,
}

const movie = (tmdbId, title, role, options = {}) => ({
  entity: {
    id: `movie:${tmdbId}`,
    entityType: 'movie',
    title,
    tmdbId,
  },
  role,
  ...options,
})

test('prioritizes prominent acting credits and penalizes self or archive appearances', () => {
  const credits = [
    movie(111, 'Archive Documentary', 'acting', { castOrder: 0, appearance: 'archive' }),
    movie(238, 'The Godfather', 'acting', { castOrder: 1 }),
    movie(240, 'The Godfather Part II', 'acting', { castOrder: 0 }),
    movie(999, 'Tiny Cameo', 'acting', { castOrder: 20 }),
    movie(222, 'Self Documentary', 'acting', { castOrder: 0, appearance: 'self' }),
  ]

  assert.deepEqual(
    expandPersonCredits(person, credits, { kind: 'person', personName: 'Marlon Brando' }).map(
      ({ entity, relationshipScore }) => [entity.tmdbId, relationshipScore]
    ),
    [
      [240, 1],
      [238, 0.99],
      [999, 0.75],
      [222, 0.25],
      [111, 0.15],
    ]
  )
})

test('prioritizes the requested directing or creator relationship', () => {
  const credits = [
    movie(1, 'Acted In', 'acting', { castOrder: 0 }),
    movie(2, 'Directed', 'directing'),
    movie(3, 'Created', 'creating'),
  ]

  assert.deepEqual(
    expandPersonCredits(person, credits, {
      kind: 'relationship',
      personName: 'Sofia Coppola',
      role: 'directing',
      mediaTypes: ['movie'],
    }).map(({ entity, role }) => [entity.tmdbId, role]),
    [
      [2, 'directing'],
      [1, 'acting'],
      [3, 'creating'],
    ]
  )

  assert.deepEqual(
    expandPersonCredits(person, credits, {
      kind: 'relationship',
      personName: 'Michaela Coel',
      role: 'creating',
    }).map(({ entity, role }) => [entity.tmdbId, role]),
    [
      [3, 'creating'],
      [1, 'acting'],
      [2, 'directing'],
    ]
  )
})

test('deduplicates by media type and TMDB id using the strongest credit', () => {
  const result = expandPersonCredits(
    person,
    [
      movie(10, 'Dual Credit', 'acting', { castOrder: 8 }),
      movie(10, 'Dual Credit', 'directing'),
      {
        ...movie(10, 'Series With Same Provider Id', 'acting', { castOrder: 0 }),
        entity: {
          id: 'series:10',
          entityType: 'series',
          title: 'Series With Same Provider Id',
          tmdbId: 10,
        },
      },
    ],
    {
      kind: 'relationship',
      personName: 'Greta Gerwig',
      role: 'directing',
    }
  )

  assert.deepEqual(
    result.map(({ entity, role }) => [entity.entityType, entity.tmdbId, role]),
    [
      ['movie', 10, 'directing'],
      ['series', 10, 'acting'],
    ]
  )
})

test('returns identical output for shuffled credits', () => {
  const credits = [
    movie(238, 'The Godfather', 'acting', { castOrder: 1 }),
    movie(240, 'The Godfather Part II', 'acting', { castOrder: 0 }),
    movie(999, 'Tiny Cameo', 'acting', { castOrder: 20 }),
  ]
  const intent = { kind: 'person', personName: 'Marlon Brando' }

  assert.deepEqual(
    expandPersonCredits(person, credits, intent),
    expandPersonCredits(person, [...credits].reverse(), intent)
  )
})
