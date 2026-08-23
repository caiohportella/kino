import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPersonalizedNewSeries } from '../../discover/server-release-relevance.ts'

function tv(id, firstAirDate) {
  return {
    id,
    media_type: 'tv',
    first_air_date: firstAirDate,
  }
}

test('keeps generic new series when there are no personalization signals', () => {
  const result = buildPersonalizedNewSeries({
    newSeries: [tv(1, '2026-08-20'), tv(2, '2026-08-18')],
    forYou: [],
    relatedSeries: [],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2]
  )
})

test('promotes a personalized recent series', () => {
  const result = buildPersonalizedNewSeries({
    newSeries: [tv(1, '2026-08-20'), tv(2, '2026-08-18')],
    forYou: [],
    relatedSeries: [
      {
        kind: 'actor',
        items: [tv(2, '2026-08-18')],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [2, 1]
  )
})

test('can insert a related series missing from the generic feed', () => {
  const result = buildPersonalizedNewSeries({
    newSeries: [tv(1, '2026-08-20'), tv(2, '2026-08-18')],
    forYou: [],
    relatedSeries: [
      {
        kind: 'studio',
        items: [tv(99, '2026-08-19')],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [1, 2, 99]
  )
})

test('combines actor creator and studio signals for series', () => {
  const shared = tv(99, '2026-08-19')

  const result = buildPersonalizedNewSeries({
    newSeries: [tv(1, '2026-08-20'), tv(2, '2026-08-18')],
    forYou: [],
    relatedSeries: [
      {
        kind: 'actor',
        items: [shared],
      },
      {
        kind: 'director',
        items: [shared],
      },
      {
        kind: 'studio',
        items: [shared, tv(50, '2026-08-17')],
      },
    ],
  })

  assert.deepEqual(
    result.map((item) => item.id),
    [99, 1, 2, 50]
  )
})
