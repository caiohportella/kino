import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeTitleDocument,
  titleDocumentFromTmdb,
  toSearchMediaType,
} from './title-document.ts'

test('normalizes a movie and series with distinct stable identities', () => {
  const movie = normalizeTitleDocument({ tmdbId: 238, type: 'movie', title: 'The Godfather' })
  const series = normalizeTitleDocument({ tmdbId: 238, type: 'tv', title: 'The Godfather' })

  assert.equal(movie?.id, 'title:movie:238')
  assert.equal(movie?.entityType, 'movie')
  assert.equal(series?.id, 'title:series:238')
  assert.equal(series?.entityType, 'series')
  assert.notEqual(movie?.id, series?.id)
})

test('normalizes title fields, localized aliases, and omits empty optional metadata', () => {
  assert.deepEqual(
    normalizeTitleDocument({
      tmdbId: 60059,
      type: 'tv',
      title: ' Better Call Saul ',
      originalTitle: 'Better Call Saul',
      overview: '  A lawyer takes the long road.  ',
      aliases: ['Saul Goodman', 'Jimmy McGill'],
      localizedTitles: { pt: 'Better Call Saul PT', 'pt-BR': 'Better Call Saul BR' },
      year: null,
      popularity: null,
      posterPath: null,
    }),
    {
      id: 'title:series:60059',
      entityType: 'series',
      mediaType: 'series',
      tmdbId: 60059,
      title: 'Better Call Saul',
      originalTitle: 'Better Call Saul',
      aliases: 'Saul Goodman Jimmy McGill',
      localizedTitles: { pt: 'Better Call Saul PT Better Call Saul BR' },
      overview: 'A lawyer takes the long road.',
      posterPath: null,
    }
  )
})

test('retains audience metrics for persisted-shaped title inputs and omits missing values safely', () => {
  assert.deepEqual(
    normalizeTitleDocument({
      tmdbId: 11,
      type: 'movie',
      title: 'Dune',
      popularity: 321.5,
      voteAverage: 8.3,
      voteCount: 27123,
    }),
    {
      id: 'title:movie:11',
      entityType: 'movie',
      mediaType: 'movie',
      tmdbId: 11,
      title: 'Dune',
      originalTitle: 'Dune',
      aliases: '',
      localizedTitles: {},
      overview: '',
      popularity: 321.5,
      voteAverage: 8.3,
      voteCount: 27123,
    }
  )

  assert.deepEqual(
    normalizeTitleDocument({
      tmdbId: 12,
      type: 'movie',
      title: 'Dune Part Two',
      popularity: null,
      voteAverage: null,
      voteCount: null,
    }),
    {
      id: 'title:movie:12',
      entityType: 'movie',
      mediaType: 'movie',
      tmdbId: 12,
      title: 'Dune Part Two',
      originalTitle: 'Dune Part Two',
      aliases: '',
      localizedTitles: {},
      overview: '',
    }
  )
})

test('converts TMDb movie and TV result shapes into search documents', () => {
  const result = titleDocumentFromTmdb({
    type: 'movie',
    title: {
      id: 238,
      title: 'The Godfather',
      overview: 'An organized crime dynasty changes hands.',
      poster_path: '/godfather.jpg',
      backdrop_path: '/bg.jpg',
      release_date: '1972-03-14',
      vote_average: 8.7,
      vote_count: 20798,
      genre_ids: [18, 80],
      media_type: 'movie',
    },
    aliases: ['Mario Puzo adaptation'],
    localizedTitles: { pt: 'O Poderoso Chefão' },
  })

  assert.equal(result?.id, 'title:movie:238')
  assert.equal(result?.year, 1972)
  assert.equal(result?.popularity, undefined)
  assert.equal(result?.voteAverage, 8.7)
  assert.equal(result?.voteCount, 20798)
  assert.equal(result?.localizedTitles.pt, 'O Poderoso Chefão')
  assert.equal(toSearchMediaType('tv'), 'series')
  assert.equal(toSearchMediaType('series'), 'series')
})

test('converts TMDb audience metrics when present and omits missing ones safely', () => {
  const populated = titleDocumentFromTmdb({
    type: 'tv',
    title: {
      id: 1399,
      name: 'Game of Thrones',
      overview: 'Winter is coming.',
      first_air_date: '2011-04-17',
      vote_average: 8.5,
      vote_count: 24567,
      genre_ids: [18],
      media_type: 'tv',
      popularity: 412.9,
    },
  })
  const missing = titleDocumentFromTmdb({
    type: 'movie',
    title: {
      id: 500,
      title: 'Reservoir Dogs',
      overview: 'Six criminals, one heist.',
      release_date: '1992-09-02',
      vote_average: null,
      vote_count: null,
      genre_ids: [80],
      media_type: 'movie',
      popularity: null,
    },
  })

  assert.equal(populated?.popularity, 412.9)
  assert.equal(populated?.voteAverage, 8.5)
  assert.equal(populated?.voteCount, 24567)
  assert.equal(missing?.popularity, undefined)
  assert.equal(missing?.voteAverage, undefined)
  assert.equal(missing?.voteCount, undefined)
})
