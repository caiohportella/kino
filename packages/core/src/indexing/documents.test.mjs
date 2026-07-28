import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchIndexDocumentV1 } from './documents.ts'

const godfatherInput = {
  id: 'movie:238',
  entityType: 'movie',
  tmdbId: 238,
  title: '  The   Godfather ',
  originalTitle: ' Il padrino ',
  alternativeTitles: [' O Poderoso Chefão ', 'El padrino', 'El padrino'],
  overview:
    ' The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son. ',
  releaseDate: ' 1972-03-14 ',
  locale: ' en-US ',
  genres: [' Drama ', 'Crime', 'Drama'],
  keywords: [' mafia ', 'family', 'mafia'],
  franchise: ' The Godfather Collection ',
  people: [
    {
      id: 'person:3084',
      name: ' Marlon   Brando ',
      role: 'acting',
      character: ' Don Vito Corleone ',
      castOrder: 0,
    },
    {
      id: 'person:1158',
      name: ' Al Pacino ',
      role: 'acting',
      character: ' Michael Corleone ',
      castOrder: 1,
    },
    {
      id: 'person:1769',
      name: ' Francis Ford Coppola ',
      role: 'directing',
    },
  ],
  contentHash: 'sha256:godfather-fixture',
  providerToken: 'must-not-escape',
}

test('builds the complete canonical Godfather index document from literal input', () => {
  assert.deepEqual(buildSearchIndexDocumentV1(godfatherInput), {
    id: 'movie:238',
    entityType: 'movie',
    searchableText: [
      'title: The Godfather',
      'original title: Il padrino',
      'alternative title: El padrino',
      'alternative title: O Poderoso Chefão',
      'overview: The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
      'acting: Marlon Brando as Don Vito Corleone',
      'acting: Al Pacino as Michael Corleone',
      'directing: Francis Ford Coppola',
      'genre: Crime',
      'genre: Drama',
      'keyword: family',
      'keyword: mafia',
      'franchise: The Godfather Collection',
      'locale: en-US',
    ].join('\n'),
    metadata: {
      tmdbId: 238,
      title: 'The Godfather',
      originalTitle: 'Il padrino',
      alternativeTitles: ['El padrino', 'O Poderoso Chefão'],
      overview:
        'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
      releaseDate: '1972-03-14',
      locale: 'en-US',
      genres: ['Crime', 'Drama'],
      keywords: ['family', 'mafia'],
      franchise: 'The Godfather Collection',
      people: [
        {
          id: 'person:3084',
          name: 'Marlon Brando',
          role: 'acting',
          character: 'Don Vito Corleone',
          castOrder: 0,
        },
        {
          id: 'person:1158',
          name: 'Al Pacino',
          role: 'acting',
          character: 'Michael Corleone',
          castOrder: 1,
        },
        {
          id: 'person:1769',
          name: 'Francis Ford Coppola',
          role: 'directing',
        },
      ],
    },
    contentHash: 'sha256:godfather-fixture',
    indexVersion: 1,
  })
})

test('filters malformed relationships and defaults absent optional metadata', () => {
  assert.deepEqual(
    buildSearchIndexDocumentV1({
      id: 'person:42',
      entityType: 'person',
      tmdbId: 42,
      name: '  Ada   Actor ',
      relationships: [
        null,
        {
          id: '',
          entityType: 'movie',
          title: 'Missing identity',
          role: 'acting',
        },
        {
          id: 'movie:1',
          entityType: 'game',
          title: 'Wrong entity',
          role: 'acting',
        },
        {
          id: 'movie:2',
          entityType: 'movie',
          title: 'Wrong role',
          role: 'producing',
        },
        {
          id: 'movie:3',
          entityType: 'movie',
          title: 'Bad order',
          role: 'acting',
          castOrder: -1,
        },
        {
          id: 'series:4',
          entityType: 'series',
          title: '  Valid   Credit ',
          role: 'creating',
        },
      ],
      contentHash: 'sha256:minimal-person',
    }),
    {
      id: 'person:42',
      entityType: 'person',
      searchableText: ['name: Ada Actor', 'creating: Valid Credit'].join('\n'),
      metadata: {
        tmdbId: 42,
        name: 'Ada Actor',
        alternativeNames: [],
        relationships: [
          {
            id: 'series:4',
            entityType: 'series',
            title: 'Valid Credit',
            role: 'creating',
          },
        ],
      },
      contentHash: 'sha256:minimal-person',
      indexVersion: 1,
    }
  )
})

test('produces byte-identical text and metadata for shuffled equivalent input', () => {
  const first = buildSearchIndexDocumentV1(godfatherInput)
  const shuffled = buildSearchIndexDocumentV1({
    ...godfatherInput,
    alternativeTitles: [...godfatherInput.alternativeTitles].reverse(),
    genres: [...godfatherInput.genres].reverse(),
    keywords: [...godfatherInput.keywords].reverse(),
    people: [...godfatherInput.people].reverse(),
  })

  assert.equal(shuffled.searchableText, first.searchableText)
  assert.equal(JSON.stringify(shuffled.metadata), JSON.stringify(first.metadata))
})
