import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizePersonDocument, personDocumentFromTmdb } from './person-document.ts'

test('normalizes a person into a stable searchable document', () => {
  assert.deepEqual(
    normalizePersonDocument({
      tmdbId: 238,
      name: '  Francis Ford Coppola ',
      aliases: ['F. F. Coppola'],
      knownForDepartment: 'Directing',
      popularity: 42.5,
      profilePath: '/coppola.jpg',
    }),
    {
      id: 'person:238',
      entityType: 'person',
      tmdbId: 238,
      name: 'Francis Ford Coppola',
      aliases: 'F. F. Coppola',
      knownForDepartment: 'Directing',
      popularity: 42.5,
      profilePath: '/coppola.jpg',
    }
  )
})

test('returns null for incomplete people and maps TMDb people', () => {
  assert.equal(normalizePersonDocument({ tmdbId: 238, name: ' ' }), null)
  assert.equal(
    personDocumentFromTmdb({
      id: 238,
      name: 'Francis Ford Coppola',
      known_for_department: 'Directing',
    })?.name,
    'Francis Ford Coppola'
  )
})
