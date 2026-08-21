import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPersonalizedDiscoverRails,
  selectPersonalizedDiscoverRails,
} from '../../discover/personalization.ts'

function title(id, mediaType = 'movie', overrides = {}) {
  return {
    id,
    media_type: mediaType,
    title: mediaType === 'movie' ? `Movie ${id}` : undefined,
    name: mediaType === 'tv' ? `Series ${id}` : undefined,
    overview: '',
    poster_path: `/poster-${id}.jpg`,
    backdrop_path: null,
    release_date: mediaType === 'movie' ? '2024-01-01' : undefined,
    first_air_date: mediaType === 'tv' ? '2024-01-01' : undefined,
    vote_average: 8,
    vote_count: 500,
    genre_ids: [],
    ...overrides,
  }
}

function affinityRow(kind, score, itemCount, overrides = {}) {
  return {
    kind,
    source: {
      id: score,
      name: `${kind} ${score}`,
      score,
      averageRating: 4.7,
      titleCount: 3,
      ...overrides.source,
    },
    items: Array.from({ length: itemCount }, (_, index) =>
      title(score * 100 + index + 1, kind === 'studio' ? 'movie' : 'tv')
    ),
    ...overrides,
  }
}

test('selects a strong because-you-liked rail before affinity', async () => {
  const seed = title(10, 'movie', {
    title: 'Past Lives',
  })

  const result = selectPersonalizedDiscoverRails({
    recommendations: Array.from({ length: 8 }, (_, index) =>
      title(index + 1)
    ),
    seed,
    affinityRows: [
      affinityRow('actor', 72, 8),
      affinityRow('director', 81, 7),
    ],
  })

  assert.deepEqual(
    result.map((rail) => rail.kind),
    ['because-you-liked', 'affinity']
  )
  assert.equal(result[0].seed.id, seed.id)
  assert.equal(result[1].affinityKind, 'director')
  assert.equal(result[1].source.name, 'director 81')
})

test('omits empty and weak rails and caps output at two', async () => {
  const result = selectPersonalizedDiscoverRails({
    recommendations: Array.from({ length: 8 }, (_, index) =>
      title(index + 1)
    ),
    seed: title(200, 'movie'),
    affinityRows: [
      affinityRow('actor', 40, 5),
      affinityRow('studio', 92, 9),
      affinityRow('director', 88, 8),
    ],
  })

  assert.equal(result.length, 2)
  assert.equal(result[0].kind, 'because-you-liked')
  assert.equal(result[1].kind, 'affinity')
  assert.equal(result[1].affinityKind, 'studio')
  assert.equal(
    result.some(
      (rail) => rail.kind === 'affinity' && rail.affinityKind === 'actor'
    ),
    false
  )
})

test('preserves the seed/source data needed for localized headings', async () => {
  const seed = title(501, 'tv', {
    name: 'Silo',
    poster_path: '/silo.jpg',
  })
  const directorRow = affinityRow('director', 77, 6, {
    source: {
      id: 900,
      name: 'Mina Director',
      averageRating: 4.9,
      titleCount: 2,
    },
  })

  const result = selectPersonalizedDiscoverRails({
    recommendations: Array.from({ length: 8 }, (_, index) =>
      title(index + 20, 'tv')
    ),
    seed,
    affinityRows: [directorRow],
  })

  assert.deepEqual(result[0].seed, seed)
  assert.equal(result[1].affinityKind, 'director')
  assert.deepEqual(result[1].source, directorRow.source)
})

test('fails closed when either personalization fetch rejects', async () => {
  const recommendationSeed = title(1000, 'movie', {
    title: 'Aftersun',
  })
  const affinity = affinityRow('director', 44, 8)
  const logged = []

  const recommendationFailure = buildPersonalizedDiscoverRails({
    recommendationResult: {
      status: 'rejected',
      reason: new Error('recommendations failed'),
    },
    affinityResult: {
      status: 'fulfilled',
      value: {
        rows: [affinity],
      },
    },
    logError(message, error) {
      logged.push({ message, error })
    },
  })

  assert.deepEqual(recommendationFailure, [])
  assert.equal(logged.length, 1)
  assert.match(logged[0].message, /personalized recommendations/i)

  const affinityFailure = buildPersonalizedDiscoverRails({
    recommendationResult: {
      status: 'fulfilled',
      value: {
        recommendations: Array.from({ length: 8 }, (_, index) =>
          title(index + 1)
        ),
        seed: recommendationSeed,
      },
    },
    affinityResult: {
      status: 'rejected',
      reason: new Error('affinity failed'),
    },
    logError(message, error) {
      logged.push({ message, error })
    },
  })

  assert.deepEqual(affinityFailure, [])
  assert.equal(logged.length, 2)
  assert.match(logged[1].message, /personalized affinity rails/i)
})

test('logs both failures before failing closed when both personalization fetches reject', async () => {
  const logged = []

  const result = buildPersonalizedDiscoverRails({
    recommendationResult: {
      status: 'rejected',
      reason: new Error('recommendations failed'),
    },
    affinityResult: {
      status: 'rejected',
      reason: new Error('affinity failed'),
    },
    logError(message, error) {
      logged.push({ message, error })
    },
  })

  assert.deepEqual(result, [])
  assert.equal(logged.length, 2)
  assert.match(logged[0].message, /personalized recommendations/i)
  assert.match(logged[1].message, /personalized affinity rails/i)
})
