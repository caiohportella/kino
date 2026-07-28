import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalizeIndexDocument, createIndexContentHash } from './content-hash.ts'

const godfatherDocument = {
  searchableText: 'title: The Godfather\nacting: Marlon Brando as Don Vito Corleone',
  metadata: {
    people: [
      {
        role: 'acting',
        name: 'Marlon Brando',
        id: 'person:3084',
        character: 'Don Vito Corleone',
        castOrder: 0,
      },
    ],
    tmdbId: 238,
    keywords: ['mafia'],
    title: 'The Godfather',
    genres: ['Crime', 'Drama'],
    alternativeTitles: ['El padrino'],
  },
  entityType: 'movie',
  indexVersion: 1,
  id: 'movie:238',
  contentHash: 'old-hash-is-not-hashed',
  indexedAt: '2026-07-28T00:00:00.000Z',
}

test('canonicalizes key order and produces the known UTF-8 SHA-256 fixture', async () => {
  const canonical =
    '{"entityType":"movie","id":"movie:238","indexVersion":1,"metadata":{"alternativeTitles":["El padrino"],"genres":["Crime","Drama"],"keywords":["mafia"],"people":[{"castOrder":0,"character":"Don Vito Corleone","id":"person:3084","name":"Marlon Brando","role":"acting"}],"title":"The Godfather","tmdbId":238},"searchableText":"title: The Godfather\\nacting: Marlon Brando as Don Vito Corleone"}'

  assert.equal(canonicalizeIndexDocument(godfatherDocument), canonical)
  assert.equal(
    await createIndexContentHash(godfatherDocument),
    '09a7fae28d617a8ff75d147ad0650dce47b584bc2b8cd29674b1fa9dd3df678c'
  )
  assert.equal(
    await createIndexContentHash({
      id: 'movie:238',
      entityType: 'movie',
      indexVersion: 1,
      searchableText: 'title: The Godfather\nacting: Marlon Brando as Don Vito Corleone',
      metadata: {
        alternativeTitles: ['El padrino'],
        genres: ['Crime', 'Drama'],
        keywords: ['mafia'],
        people: [
          {
            castOrder: 0,
            character: 'Don Vito Corleone',
            id: 'person:3084',
            name: 'Marlon Brando',
            role: 'acting',
          },
        ],
        title: 'The Godfather',
        tmdbId: 238,
      },
      contentHash: 'different-runtime-hash',
      updatedAt: '2030-01-01T00:00:00.000Z',
    }),
    '09a7fae28d617a8ff75d147ad0650dce47b584bc2b8cd29674b1fa9dd3df678c'
  )
})

test('changes the hash when title, relationship, or index version changes', async () => {
  const original = await createIndexContentHash(godfatherDocument)
  const variants = [
    {
      ...godfatherDocument,
      metadata: { ...godfatherDocument.metadata, title: 'The Godfather Part II' },
    },
    {
      ...godfatherDocument,
      metadata: {
        ...godfatherDocument.metadata,
        people: [{ ...godfatherDocument.metadata.people[0], name: 'Al Pacino' }],
      },
    },
    { ...godfatherDocument, indexVersion: 2 },
  ]

  for (const variant of variants) {
    assert.notEqual(await createIndexContentHash(variant), original)
  }
})
