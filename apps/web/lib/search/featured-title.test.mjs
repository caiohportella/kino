import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getFeaturedTitleCompletion,
  selectFeaturedTitleResult,
  titleSearchResultIdentity,
  withoutFeaturedTitleResult,
} from './featured-title.ts'

function titleResult(overrides = {}) {
  return {
    kind: 'title',
    id: 'title:movie:1',
    imagePath: '/poster.jpg',
    mediaType: 'movie',
    name: 'Game Night',
    year: 2018,
    media: {
      id: 1,
      backdrop_path: null,
      genre_ids: [],
      media_type: 'movie',
      overview: 'A game night goes off the rails.',
      poster_path: '/poster.jpg',
      release_date: '2018-01-01',
      title: 'Game Night',
      vote_average: 6.9,
      vote_count: 12000,
      popularity: 50,
      ...overrides.media,
    },
    ...overrides,
  }
}

test('selects a canonical high-confidence title for broad lexical queries', () => {
  const selected = selectFeaturedTitleResult('game', [
    titleResult({
      id: 'title:tv:1399',
      mediaType: 'tv',
      name: 'Game of Thrones',
      year: 2011,
      media: {
        id: 1399,
        media_type: 'tv',
        name: 'Game of Thrones',
        overview: 'Nine noble families fight for control.',
        first_air_date: '2011-01-01',
        vote_average: 9.2,
        vote_count: 23000,
        popularity: 900,
      },
    }),
    titleResult({
      id: 'title:movie:6145',
      name: 'The Imitation Game',
      media: {
        id: 6145,
        title: 'The Imitation Game',
        overview: 'A wartime drama.',
        vote_average: 8.0,
        vote_count: 16000,
        popularity: 70,
      },
    }),
    titleResult({
      id: 'title:movie:68784',
      name: 'Game Night',
      media: {
        id: 68784,
        title: 'Game Night',
        overview: 'A mystery game night.',
        vote_average: 6.9,
        vote_count: 12000,
        popularity: 40,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.name, 'Game of Thrones')
})

test('selects Better Call Saul for better when it outranks weaker literal matches', () => {
  const selected = selectFeaturedTitleResult('better', [
    titleResult({
      id: 'title:tv:60059',
      mediaType: 'tv',
      name: 'Better Call Saul',
      year: 2015,
      media: {
        id: 60059,
        media_type: 'tv',
        name: 'Better Call Saul',
        vote_average: 8.7,
        vote_count: 6000,
        popularity: 320,
      },
    }),
    titleResult({
      id: 'title:movie:100',
      name: 'Better Things',
      media: {
        id: 100,
        title: 'Better Things',
        vote_average: 7.5,
        vote_count: 3000,
        popularity: 85,
      },
    }),
    titleResult({
      id: 'title:movie:101',
      name: 'Better Days',
      media: {
        id: 101,
        title: 'Better Days',
        vote_average: 7.1,
        vote_count: 1200,
        popularity: 20,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.name, 'Better Call Saul')
})

test('selects a canonical Superman title over obscure literal matches', () => {
  const selected = selectFeaturedTitleResult('superman', [
    titleResult({
      id: 'title:movie:10236',
      name: 'Superman',
      media: {
        id: 10236,
        title: 'Superman',
        vote_average: 7.1,
        vote_count: 8000,
        popularity: 500,
      },
    }),
    titleResult({
      id: 'title:movie:9991',
      name: 'The Superman',
      media: {
        id: 9991,
        title: 'The Superman',
        vote_average: 5.0,
        vote_count: 120,
        popularity: 2,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.name, 'Superman')
})

test('prefers an exact match over a merely more popular partial match', () => {
  const selected = selectFeaturedTitleResult('Game Night', [
    titleResult({
      id: 'title:tv:1399',
      mediaType: 'tv',
      name: 'Game of Thrones',
      year: 2011,
      media: {
        id: 1399,
        media_type: 'tv',
        name: 'Game of Thrones',
        vote_average: 9.2,
        vote_count: 23000,
        popularity: 900,
      },
    }),
    titleResult({
      id: 'title:movie:68784',
      name: 'Game Night',
      media: {
        id: 68784,
        title: 'Game Night',
        vote_average: 6.9,
        vote_count: 12000,
        popularity: 40,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.name, 'Game Night')
})

test('featured title selects Duna 2021 for comparable strong matches', () => {
  const selected = selectFeaturedTitleResult('duna', [
    titleResult({
      id: 'title:movie:2018',
      name: 'Duna',
      year: 2018,
      media: {
        id: 2018,
        title: 'Duna',
        vote_average: 7.1,
        vote_count: 100,
        popularity: 2,
      },
    }),
    titleResult({
      id: 'title:movie:2021',
      name: 'Duna: Parte Um',
      year: 2021,
      media: {
        id: 2021,
        title: 'Duna: Parte Um',
        vote_average: 8.0,
        vote_count: 30000,
        popularity: 500,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.year, 2021)
})

test('featured title selects the audience-recognized Obsession result', () => {
  const selected = selectFeaturedTitleResult('obsession', [
    titleResult({
      id: 'title:movie:1976',
      name: 'Obsession',
      year: 1976,
      media: {
        id: 1976,
        title: 'Obsession',
        vote_average: 6.8,
        vote_count: 80,
        popularity: 1,
      },
    }),
    titleResult({
      id: 'title:movie:2019',
      name: 'Obsession: Dark Desires',
      year: 2019,
      media: {
        id: 2019,
        title: 'Obsession: Dark Desires',
        vote_average: 7.6,
        vote_count: 12000,
        popularity: 120,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.year, 2019)
})

test('localized strong match participates in audience reordering', () => {
  const selected = selectFeaturedTitleResult('duna', [
    titleResult({
      id: 'title:movie:101',
      name: 'Duna',
      media: {
        id: 101,
        title: 'Dune',
        vote_average: 8.4,
        vote_count: 80,
        popularity: 2,
      },
    }),
    titleResult({
      id: 'title:movie:102',
      name: 'Duna: Parte Um',
      media: {
        id: 102,
        title: 'Dune: Part One',
        vote_average: 7.9,
        vote_count: 20000,
        popularity: 300,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.media.id, 102)
})

test('falls back to the ranked semantic leader when no lexical title match exists', () => {
  const selected = selectFeaturedTitleResult('breaking bad lawyer', [
    titleResult({
      id: 'title:tv:60059',
      mediaType: 'tv',
      name: 'Better Call Saul',
      year: 2015,
      media: {
        id: 60059,
        media_type: 'tv',
        name: 'Better Call Saul',
        vote_average: 8.7,
        vote_count: 6000,
        popularity: 320,
      },
    }),
    titleResult({
      id: 'title:movie:999',
      name: 'Lawyer Movie',
      media: {
        id: 999,
        title: 'Lawyer Movie',
        vote_average: 4.2,
        vote_count: 10,
        popularity: 1,
      },
    }),
  ])

  assert.ok(selected)
  assert.equal(selected?.name, 'Better Call Saul')
})

test('returns null when there are no title results', () => {
  assert.equal(selectFeaturedTitleResult('game', []), null)
})

test('derives a lexical completion suffix from the featured title', () => {
  const result = titleResult({
    id: 'title:tv:1399',
    mediaType: 'tv',
    name: 'Game of Thrones',
    media: { id: 1399, media_type: 'tv', name: 'Game of Thrones' },
  })

  assert.equal(getFeaturedTitleCompletion('game', result), ' of Thrones')
  assert.equal(getFeaturedTitleCompletion('game o', result), 'f Thrones')
  assert.equal(getFeaturedTitleCompletion('breaking bad lawyer', result), null)
})

test('produces a stable canonical title identity', () => {
  const selected = titleResult({
    id: 'title:tv:1399',
    mediaType: 'tv',
    name: 'Game of Thrones',
    media: { id: 1399, media_type: 'tv', name: 'Game of Thrones' },
  })

  assert.equal(titleSearchResultIdentity(selected), 'tv:1399')
})

test('removes the featured title from the compact title list', () => {
  const featured = titleResult({
    id: 'title:tv:1399',
    mediaType: 'tv',
    name: 'Game of Thrones',
    media: { id: 1399, media_type: 'tv', name: 'Game of Thrones' },
  })
  const compact = withoutFeaturedTitleResult(
    [
      featured,
      titleResult({
        id: 'title:movie:68784',
        name: 'Game Night',
        media: { id: 68784, title: 'Game Night' },
      }),
    ],
    featured
  )

  assert.deepEqual(
    compact.map((result) => result.name),
    ['Game Night']
  )
})

test('featured title and compact list use one identity and do not duplicate the selected result', () => {
  const results = [
    titleResult({
      id: 'title:movie:2018',
      name: 'Duna',
      year: 2018,
      media: {
        id: 2018,
        title: 'Duna',
        vote_average: 7.1,
        vote_count: 100,
        popularity: 2,
      },
    }),
    titleResult({
      id: 'title:movie:2021',
      name: 'Duna: Parte Um',
      year: 2021,
      media: {
        id: 2021,
        title: 'Duna: Parte Um',
        vote_average: 8.0,
        vote_count: 30000,
        popularity: 500,
      },
    }),
  ]
  const featured = selectFeaturedTitleResult('duna', results)

  assert.deepEqual(
    withoutFeaturedTitleResult(results, featured).map((result) => result.media.id),
    [2018]
  )
})
