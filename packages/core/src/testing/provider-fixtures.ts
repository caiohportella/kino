export const movieFixture = {
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
}

export const seriesFixture = {
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
}

export const personFixture = {
  people: [
    {
      id: 3084,
      name: 'Marlon Brando',
      role: 'cast',
      character: 'Don Vito Corleone',
      order: 0,
    },
  ],
}

export const semanticCandidateFixture = {
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
}

export const tmdbFallbackFixture = {
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
}
