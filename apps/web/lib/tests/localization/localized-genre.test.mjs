import assert from 'node:assert/strict'
import test from 'node:test'

import { getLocalizedGenreName } from '../../localization/localized-genre.ts'

test('resolves a genre by its TMDb locale key', () => {
  const t = (key, options) => {
    if (key === 'genres.99') return 'Documentário'
    return options?.defaultValue ?? key
  }

  assert.equal(
    getLocalizedGenreName(
      {
        id: 99,
        name: 'Documentary',
      },
      t
    ),
    'Documentário'
  )
})

test('falls back to the persisted genre name when translation is missing', () => {
  const t = (_key, options) => options?.defaultValue ?? ''

  assert.equal(
    getLocalizedGenreName(
      {
        id: 999999,
        name: 'Unknown Genre',
      },
      t
    ),
    'Unknown Genre'
  )
})

test('falls back to the persisted name when a genre has no id', () => {
  const t = () => {
    throw new Error('translation should not be requested without an id')
  }

  assert.equal(
    getLocalizedGenreName(
      {
        name: 'Documentary',
      },
      t
    ),
    'Documentary'
  )
})
