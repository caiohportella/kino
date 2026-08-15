import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLifetimeLocalizationRequest,
  buildLifetimePosterPreloadItems,
  getLifetimeFeaturedMoviePills,
  getLifetimeFeaturedSeriesPills,
  formatKinoMembership,
  getDisplayedLifetimeStoryItems,
} from './profile-lifetime-recap-story.ts'

function title(overrides) {
  return {
    titleId: overrides.titleId,
    tmdbId: overrides.tmdbId,
    title: overrides.title ?? overrides.titleId,
    mediaType: overrides.mediaType,
    count: overrides.count ?? 1,
    rating: overrides.rating ?? 4,
    coverImage: Object.hasOwn(overrides, 'coverImage')
      ? overrides.coverImage
      : `/${overrides.titleId}.jpg`,
    watchTimeMinutes: overrides.watchTimeMinutes ?? 90,
    watchedEpisodeCount: overrides.watchedEpisodeCount,
  }
}

function recap(overrides = {}) {
  return {
    moviesWatched: 0,
    episodesWatched: 0,
    timeWatchedMinutes: 0,
    ratingsMade: 0,
    topRatedMovies: overrides.topRatedMovies ?? [],
    topRatedSeries: overrides.topRatedSeries ?? [],
    topGenres: [],
    mostRatedGenre: null,
    highestRatedStudio: null,
    highestRatedActor: null,
    highestRatedActress: null,
    highestRatedGenre: null,
    highestRatedDecade: null,
  }
}

test('lifetime story selects featured titles and runner-up ranks without duplicating featured items', () => {
  const movie1 = title({ titleId: 'movie-1', tmdbId: 101, mediaType: 'movie' })
  const movie2 = title({ titleId: 'movie-2', tmdbId: 102, mediaType: 'movie' })
  const movie3 = title({ titleId: 'movie-3', tmdbId: 103, mediaType: 'movie' })
  const movie4 = title({ titleId: 'movie-4', tmdbId: 104, mediaType: 'movie' })
  const movie5 = title({ titleId: 'movie-5', tmdbId: 105, mediaType: 'movie' })
  const series1 = title({ titleId: 'series-1', tmdbId: 201, mediaType: 'tv' })
  const series2 = title({ titleId: 'series-2', tmdbId: 202, mediaType: 'tv' })
  const series3 = title({ titleId: 'series-3', tmdbId: 203, mediaType: 'tv' })
  const series4 = title({ titleId: 'series-4', tmdbId: 204, mediaType: 'tv' })
  const series5 = title({ titleId: 'series-5', tmdbId: 205, mediaType: 'tv' })

  const displayed = getDisplayedLifetimeStoryItems(
    recap({
      topRatedMovies: [movie1, movie2, movie3, movie4, movie5],
      topRatedSeries: [series1, series2, series3, series4, series5],
    })
  )

  assert.equal(displayed.featuredMovie, movie1)
  assert.equal(displayed.featuredSeries, series1)
  assert.deepEqual(
    displayed.movieRunnersUp.map(({ item, rank }) => [item.titleId, rank]),
    [
      ['movie-2', 2],
      ['movie-3', 3],
      ['movie-4', 4],
    ]
  )
  assert.deepEqual(
    displayed.seriesRunnersUp.map(({ item, rank }) => [item.titleId, rank]),
    [
      ['series-2', 2],
      ['series-3', 3],
      ['series-4', 4],
    ]
  )
  assert(!displayed.movieRunnersUp.some(({ item }) => item.titleId === 'movie-1'))
  assert(!displayed.seriesRunnersUp.some(({ item }) => item.titleId === 'series-1'))
})

test('lifetime localization request contains all displayed movie and series items with resolved region', () => {
  const displayed = getDisplayedLifetimeStoryItems(
    recap({
      topRatedMovies: [
        title({ titleId: 'movie-1', tmdbId: 101, mediaType: 'movie' }),
        title({ titleId: 'movie-2', tmdbId: 102, mediaType: 'movie' }),
        title({ titleId: 'movie-3', tmdbId: 103, mediaType: 'movie' }),
        title({ titleId: 'movie-4', tmdbId: 104, mediaType: 'movie' }),
        title({ titleId: 'movie-5', tmdbId: 105, mediaType: 'movie' }),
      ],
      topRatedSeries: [
        title({ titleId: 'series-1', tmdbId: 201, mediaType: 'tv' }),
        title({ titleId: 'series-2', tmdbId: 202, mediaType: 'tv' }),
        title({ titleId: 'series-3', tmdbId: 203, mediaType: 'tv' }),
        title({ titleId: 'series-4', tmdbId: 204, mediaType: 'tv' }),
        title({ titleId: 'series-5', tmdbId: 205, mediaType: 'tv' }),
      ],
    })
  )

  const request = buildLifetimeLocalizationRequest(displayed, 'pt-BR')

  assert.equal(request.locale, 'pt-BR')
  assert.equal(request.region, 'BR')
  assert.deepEqual(request.items, [
    { tmdbId: 101, type: 'movie' },
    { tmdbId: 102, type: 'movie' },
    { tmdbId: 103, type: 'movie' },
    { tmdbId: 104, type: 'movie' },
    { tmdbId: 201, type: 'tv' },
    { tmdbId: 202, type: 'tv' },
    { tmdbId: 203, type: 'tv' },
    { tmdbId: 204, type: 'tv' },
  ])
})

test('lifetime localization request falls back to US when locale has no region mapping', () => {
  const displayed = getDisplayedLifetimeStoryItems(
    recap({
      topRatedMovies: [title({ titleId: 'movie-1', tmdbId: 101, mediaType: 'movie' })],
      topRatedSeries: [],
    })
  )

  const request = buildLifetimeLocalizationRequest(displayed, 'zz')

  assert.equal(request.locale, 'zz')
  assert.equal(request.region, 'US')
  assert.deepEqual(request.items, [{ tmdbId: 101, type: 'movie' }])
})

test('lifetime poster preload covers displayed items once by unique title id', () => {
  const duplicate = title({
    titleId: 'shared-title',
    tmdbId: 999,
    mediaType: 'movie',
    coverImage: '/shared.jpg',
  })
  const displayed = {
    featuredMovie: duplicate,
    featuredSeries: title({
      titleId: 'series-1',
      tmdbId: 201,
      mediaType: 'tv',
      coverImage: '/series-1.jpg',
    }),
    movieRunnersUp: [
      {
        rank: 2,
        item: duplicate,
      },
      {
        rank: 3,
        item: title({
          titleId: 'movie-2',
          tmdbId: 102,
          mediaType: 'movie',
          coverImage: null,
        }),
      },
    ],
    seriesRunnersUp: [
      {
        rank: 2,
        item: title({
          titleId: 'series-2',
          tmdbId: 202,
          mediaType: 'tv',
          coverImage: '/series-2.jpg',
        }),
      },
    ],
  }

  assert.deepEqual(
    buildLifetimePosterPreloadItems(displayed).map((item) => [
      item.titleId,
      item.tmdbId,
      item.coverImage,
    ]),
    [
      ['shared-title', 999, '/shared.jpg'],
      ['movie-2', 102, null],
      ['series-1', 201, '/series-1.jpg'],
      ['series-2', 202, '/series-2.jpg'],
    ]
  )
})

test('lifetime featured pills use movie diary count and series watched episode count', () => {
  const movie = title({
    titleId: 'movie-1',
    tmdbId: 101,
    mediaType: 'movie',
    count: 3,
    rating: 4.5,
  })
  const series = title({
    titleId: 'series-1',
    tmdbId: 201,
    mediaType: 'tv',
    count: 7,
    rating: 4,
    watchedEpisodeCount: 12,
  })
  const labels = {
    ratingShort: 'Rating',
    watchedTimes: 'Watched',
    episodesWatched: 'Episodes watched',
  }

  assert.deepEqual(getLifetimeFeaturedMoviePills(movie, labels, 'en-US'), [
    {
      id: 'rating',
      text: 'Rating 4.5',
    },
    {
      id: 'diary-count',
      text: 'Watched 3×',
    },
  ])
  assert.deepEqual(getLifetimeFeaturedSeriesPills(series, labels, 'en-US'), [
    {
      id: 'rating',
      text: 'Rating 4',
    },
    {
      id: 'episodes',
      text: '12 episodes watched',
    },
  ])
})

test('Kino membership formats days, months, years, and member-since year with injected translator', () => {
  const calls = []
  const t = (key, values) => {
    calls.push([key, values])
    if (key === 'stats.story.kinoTimeDays') return `${values.count} days`
    if (key === 'stats.story.kinoTimeMonths') return `${values.count} months`
    if (key === 'stats.story.kinoTimeYears') return `${values.count} years`
    if (key === 'stats.story.memberSince') return `Since ${values.year}`
    return key
  }

  assert.deepEqual(formatKinoMembership('2026-08-10T12:00:00Z', t, new Date('2026-08-15T12:00:00Z')), {
    kinoTime: '5 days',
    memberSince: 'Since 2026',
  })
  assert.deepEqual(formatKinoMembership('2026-06-15T12:00:00Z', t, new Date('2026-08-15T12:00:00Z')), {
    kinoTime: '2 months',
    memberSince: 'Since 2026',
  })
  assert.deepEqual(formatKinoMembership('2024-08-15T12:00:00Z', t, new Date('2026-08-15T12:00:00Z')), {
    kinoTime: '2 years',
    memberSince: 'Since 2024',
  })

  assert.deepEqual(calls, [
    ['stats.story.kinoTimeDays', { count: 5 }],
    ['stats.story.memberSince', { year: 2026 }],
    ['stats.story.kinoTimeMonths', { count: 2 }],
    ['stats.story.memberSince', { year: 2026 }],
    ['stats.story.kinoTimeYears', { count: 2 }],
    ['stats.story.memberSince', { year: 2024 }],
  ])
})

test('Kino membership clamps leap-day and month-end anniversaries to the last valid day', () => {
  const t = (key, values) => `${key}:${values.count ?? values.year}`

  assert.equal(
    formatKinoMembership('2024-02-29T12:00:00Z', t, new Date('2025-02-28T12:00:00Z')).kinoTime,
    'stats.story.kinoTimeYears:1'
  )
  assert.equal(
    formatKinoMembership('2026-01-31T12:00:00Z', t, new Date('2026-02-28T12:00:00Z')).kinoTime,
    'stats.story.kinoTimeMonths:1'
  )
})
