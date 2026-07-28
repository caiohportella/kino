import assert from 'node:assert/strict'
import test from 'node:test'
import { SEARCH_INDEX_SCHEMA_VERSION, versionSearchIndexDocumentV1 } from './index.ts'

test('serializes the independent index schema version into a movie document', () => {
  const document = versionSearchIndexDocumentV1({
    id: 'movie:238',
    entityType: 'movie',
    searchableText: 'The Godfather',
    metadata: {
      tmdbId: 238,
      title: 'The Godfather',
      alternativeTitles: ['O Poderoso Chefão'],
      genres: ['Crime', 'Drama'],
      keywords: ['mafia'],
      people: [
        {
          id: 'person:3084',
          name: 'Marlon Brando',
          role: 'acting',
          character: 'Don Vito Corleone',
          castOrder: 0,
        },
      ],
    },
    contentHash: 'sha256:movie-fixture',
  })

  assert.equal(SEARCH_INDEX_SCHEMA_VERSION, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(document)), {
    id: 'movie:238',
    entityType: 'movie',
    searchableText: 'The Godfather',
    metadata: {
      tmdbId: 238,
      title: 'The Godfather',
      alternativeTitles: ['O Poderoso Chefão'],
      genres: ['Crime', 'Drama'],
      keywords: ['mafia'],
      people: [
        {
          id: 'person:3084',
          name: 'Marlon Brando',
          role: 'acting',
          character: 'Don Vito Corleone',
          castOrder: 0,
        },
      ],
    },
    contentHash: 'sha256:movie-fixture',
    indexVersion: 1,
  })
})

test('preserves the literal person metadata shape while stamping its version', () => {
  assert.deepEqual(
    versionSearchIndexDocumentV1({
      id: 'person:3084',
      entityType: 'person',
      searchableText: 'Marlon Brando',
      metadata: {
        tmdbId: 3084,
        name: 'Marlon Brando',
        alternativeNames: ['Marlon Brando Jr.'],
        relationships: [
          {
            id: 'movie:238',
            entityType: 'movie',
            title: 'The Godfather',
            role: 'acting',
            character: 'Don Vito Corleone',
            castOrder: 0,
          },
        ],
      },
      contentHash: 'sha256:person-fixture',
    }),
    {
      id: 'person:3084',
      entityType: 'person',
      searchableText: 'Marlon Brando',
      metadata: {
        tmdbId: 3084,
        name: 'Marlon Brando',
        alternativeNames: ['Marlon Brando Jr.'],
        relationships: [
          {
            id: 'movie:238',
            entityType: 'movie',
            title: 'The Godfather',
            role: 'acting',
            character: 'Don Vito Corleone',
            castOrder: 0,
          },
        ],
      },
      contentHash: 'sha256:person-fixture',
      indexVersion: 1,
    }
  )
})
