import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getFeaturedTitleCompletion,
  selectFeaturedTitleResult,
  titleSearchResultIdentity,
  withoutFeaturedTitleResult,
} from './featured-title.ts'

function titleResult(overrides = {}) {
  const { media: mediaOverrides = {}, ...resultOverrides } = overrides

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
      vote_count: 12_000,
      popularity: 50,
      ...mediaOverrides,
    },
    ...resultOverrides,
  }
}

test('uses the first gateway-ranked title as the featured result', () => {
  const rankedLeader = titleResult({
    id: 'title:movie:2021',
    name: 'Duna',
    year: 2021,
    media: {
      id: 2021,
      title: 'Duna',
      vote_average: 8,
      vote_count: 30_000,
      popularity: 500,
    },
  })

  const second = titleResult({
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
  })

  const selected = selectFeaturedTitleResult('duna', [rankedLeader, second])

  assert.equal(selected?.media.id, 2021)
})

test('does not rerank results using only the localized display title', () => {
  const recognized = titleResult({
    id: 'title:movie:1084199',
    name: 'Acompanhante Perfeita',
    year: 2025,
    media: {
      id: 1084199,
      title: 'Acompanhante Perfeita',
      release_date: '2025-01-22',
      vote_average: 7.1,
      vote_count: 10_000,
      popularity: 300,
    },
  })

  const obscureLiteral = titleResult({
    id: 'title:movie:200001',
    name: 'Companion',
    year: 2023,
    media: {
      id: 200001,
      title: 'Companion',
      release_date: '2023-01-01',
      vote_average: 5,
      vote_count: 10,
      popularity: 1,
    },
  })

  const selected = selectFeaturedTitleResult('companion', [recognized, obscureLiteral])

  assert.equal(selected?.media.id, 1084199)
  assert.equal(selected?.name, 'Acompanhante Perfeita')
})

test('does not replace a ranked localized title with a weaker literal English result', () => {
  const recognized = titleResult({
    id: 'title:movie:16869',
    name: 'Bastardos Inglórios',
    year: 2009,
    media: {
      id: 16869,
      title: 'Bastardos Inglórios',
      release_date: '2009-08-19',
      vote_average: 8.2,
      vote_count: 22_000,
      popularity: 100,
    },
  })

  const weakerLiteral = titleResult({
    id: 'title:movie:200002',
    name: 'The Real Inglorious Bastards',
    year: 2012,
    media: {
      id: 200002,
      title: 'The Real Inglorious Bastards',
      release_date: '2012-01-01',
      vote_average: 5,
      vote_count: 20,
      popularity: 1,
    },
  })

  const selected = selectFeaturedTitleResult('inglorious bastards', [recognized, weakerLiteral])

  assert.equal(selected?.media.id, 16869)
  assert.equal(selected?.name, 'Bastardos Inglórios')
})

test('preserves the ranked localized result for an original-title query', () => {
  const recognized = titleResult({
    id: 'title:movie:550',
    name: 'Clube da Luta',
    year: 1999,
    media: {
      id: 550,
      title: 'Clube da Luta',
      release_date: '1999-10-15',
      vote_average: 8.4,
      vote_count: 30_000,
      popularity: 150,
    },
  })

  const obscureLiteral = titleResult({
    id: 'title:movie:200003',
    name: 'Fight Club',
    year: 2023,
    media: {
      id: 200003,
      title: 'Fight Club',
      release_date: '2023-01-01',
      vote_average: 4,
      vote_count: 5,
      popularity: 1,
    },
  })

  const selected = selectFeaturedTitleResult('fight club', [recognized, obscureLiteral])

  assert.equal(selected?.media.id, 550)
  assert.equal(selected?.name, 'Clube da Luta')
})

test('does not reorder the gateway result list based on audience data', () => {
  const first = titleResult({
    id: 'title:movie:10',
    name: 'Example',
    media: {
      id: 10,
      title: 'Example',
      vote_count: 10,
      popularity: 1,
    },
  })

  const second = titleResult({
    id: 'title:movie:20',
    name: 'Example',
    media: {
      id: 20,
      title: 'Example',
      vote_count: 100_000,
      popularity: 10_000,
    },
  })

  const selected = selectFeaturedTitleResult('example', [first, second])

  assert.equal(selected?.media.id, 10)
})

test('returns null for an empty query', () => {
  const result = titleResult()

  assert.equal(selectFeaturedTitleResult('', [result]), null)
  assert.equal(selectFeaturedTitleResult('   ', [result]), null)
})

test('returns null when there are no title results', () => {
  assert.equal(selectFeaturedTitleResult('game', []), null)
})

test('derives a lexical completion suffix from the featured display title', () => {
  const result = titleResult({
    id: 'title:tv:1399',
    mediaType: 'tv',
    name: 'Game of Thrones',
    media: {
      id: 1399,
      media_type: 'tv',
      name: 'Game of Thrones',
      title: undefined,
    },
  })

  assert.equal(getFeaturedTitleCompletion('game', result), ' of Thrones')
  assert.equal(getFeaturedTitleCompletion('game o', result), 'f Thrones')
})

test('does not generate completion when the localized display title does not start with the query', () => {
  const companion = titleResult({
    id: 'title:movie:1084199',
    name: 'Acompanhante Perfeita',
    media: {
      id: 1084199,
      title: 'Acompanhante Perfeita',
    },
  })

  const ingloriousBasterds = titleResult({
    id: 'title:movie:16869',
    name: 'Bastardos Inglórios',
    media: {
      id: 16869,
      title: 'Bastardos Inglórios',
    },
  })

  assert.equal(getFeaturedTitleCompletion('companion', companion), null)
  assert.equal(getFeaturedTitleCompletion('inglorious bastards', ingloriousBasterds), null)
})

test('does not generate completion after the full title has been entered', () => {
  const result = titleResult({
    name: 'Game Night',
    media: {
      id: 1,
      title: 'Game Night',
    },
  })

  assert.equal(getFeaturedTitleCompletion('Game Night', result), null)
})

test('produces a stable canonical title identity', () => {
  const movie = titleResult({
    id: 'title:movie:550',
    mediaType: 'movie',
    media: {
      id: 550,
      title: 'Clube da Luta',
    },
  })

  const series = titleResult({
    id: 'title:tv:1399',
    mediaType: 'tv',
    media: {
      id: 1399,
      media_type: 'tv',
      name: 'Game of Thrones',
      title: undefined,
    },
  })

  assert.equal(titleSearchResultIdentity(movie), 'movie:550')
  assert.equal(titleSearchResultIdentity(series), 'tv:1399')
})

test('removes the featured title from the compact result list by identity', () => {
  const featured = titleResult({
    id: 'title:movie:550',
    name: 'Clube da Luta',
    media: {
      id: 550,
      title: 'Clube da Luta',
    },
  })

  const other = titleResult({
    id: 'title:movie:16869',
    name: 'Bastardos Inglórios',
    media: {
      id: 16869,
      title: 'Bastardos Inglórios',
    },
  })

  const compact = withoutFeaturedTitleResult([featured, other], featured)

  assert.deepEqual(
    compact.map((result) => result.media.id),
    [16869]
  )
})

test('does not remove another media type that happens to share the same numeric id', () => {
  const movie = titleResult({
    id: 'title:movie:238',
    mediaType: 'movie',
    media: {
      id: 238,
      media_type: 'movie',
      title: 'Movie',
    },
  })

  const series = titleResult({
    id: 'title:tv:238',
    mediaType: 'tv',
    media: {
      id: 238,
      media_type: 'tv',
      name: 'Series',
      title: undefined,
    },
  })

  const compact = withoutFeaturedTitleResult([movie, series], movie)

  assert.equal(compact.length, 1)
  assert.equal(compact[0]?.mediaType, 'tv')
  assert.equal(compact[0]?.media.id, 238)
})

test('returns the original results when there is no featured result', () => {
  const results = [
    titleResult({
      id: 'title:movie:1',
      media: { id: 1, title: 'One' },
    }),
    titleResult({
      id: 'title:movie:2',
      media: { id: 2, title: 'Two' },
    }),
  ]

  assert.deepEqual(withoutFeaturedTitleResult(results, null), results)
})
