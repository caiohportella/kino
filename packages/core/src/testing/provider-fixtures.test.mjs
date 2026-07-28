import assert from 'node:assert/strict'
import test from 'node:test'

import {
  movieFixture,
  personFixture,
  semanticCandidateFixture,
  seriesFixture,
  tmdbFallbackFixture,
} from './provider-fixtures.ts'

test('movie fixture provides a complete normalized movie input', () => {
  assert.deepEqual(movieFixture, {
    id: 238,
    title: 'The Godfather',
    originalTitle: 'The Godfather',
    overview:
      'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
    releaseDate: '1972-03-14',
    posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    backdropPath: '/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
    voteAverage: 8.689,
    voteCount: 20798,
    genreIds: [18, 80],
  })
})

test('series fixture provides a complete normalized series input', () => {
  assert.deepEqual(seriesFixture, {
    id: 1396,
    name: 'Breaking Bad',
    originalName: 'Breaking Bad',
    overview:
      "When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live, he becomes filled with a sense of fearlessness and an unrelenting desire to secure his family's financial future at any cost as he enters the dangerous world of drugs and crime.",
    firstAirDate: '2008-01-20',
    posterPath: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    backdropPath: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    voteAverage: 8.935,
    voteCount: 16095,
    genreIds: [18, 80],
  })
})

test('person fixture includes every normalized relationship field', () => {
  assert.deepEqual(personFixture.people[0], {
    id: 3084,
    name: 'Marlon Brando',
    role: 'cast',
    character: 'Don Vito Corleone',
    order: 0,
  })
})

test('semantic candidate fixture provides a complete semantic search input', () => {
  assert.deepEqual(semanticCandidateFixture, {
    id: 'movie-238',
    title: 'The Godfather',
    type: 'movie',
    overview:
      'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
    score: 0.942,
    metadata: {
      tmdbId: 238,
      releaseDate: '1972-03-14',
      genreIds: [18, 80],
    },
  })
})

test('TMDB fallback fixture provides complete fallback inputs', () => {
  assert.notStrictEqual(tmdbFallbackFixture.results[0], movieFixture)

  assert.deepEqual(tmdbFallbackFixture, {
    query: 'The Godfather',
    mediaType: 'movie',
    page: 1,
    results: [
      {
        id: 238,
        title: 'The Godfather',
        originalTitle: 'The Godfather',
        overview:
          'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
        releaseDate: '1972-03-14',
        posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
        backdropPath: '/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
        voteAverage: 8.689,
        voteCount: 20798,
        genreIds: [18, 80],
      },
    ],
  })
})
