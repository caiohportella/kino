import assert from 'node:assert/strict'
import test from 'node:test'
import * as profileCollectionFilters from '../../profile/profile-collection-filters.ts'
import {
  DEFAULT_PROFILE_COLLECTION_FILTERS,
  filterAndSortProfileCollection,
  paginateProfileCollection,
  parseProfileCollectionFilters,
  serializeProfileCollectionFilters,
} from '../../profile/profile-collection-filters.ts'

const defaultFilters = () => parseProfileCollectionFilters(new URLSearchParams())

const countActiveProfileCollectionFilters = Reflect.get(
  profileCollectionFilters,
  'countActiveProfileCollectionFilters'
)

const alien = {
  id: 'alien',
  title: 'Alien',
  originalTitle: 'Alien',
  releaseYear: 1979,
  genres: [{ id: 878, name: 'Science Fiction' }],
  userRating: 4.5,
  tmdbRating: 8.2,
  tmdbVoteCount: 20_000,
  tmdbPopularity: 120,
  runtimeMinutes: 117,
  latestWatchedAt: '2026-03-02T12:00:00.000Z',
  latestActivityAt: '2026-03-03T12:00:00.000Z',
  watchCount: 2,
  watchEvents: [
    {
      id: 'alien-first',
      watchedAt: '2024-01-01T12:00:00.000Z',
      watchType: 'first-time',
    },
    {
      id: 'alien-rewatch',
      watchedAt: '2026-03-02T12:00:00.000Z',
      watchType: 'rewatch',
    },
  ],
  seriesPasses: [],
}

test('parses collection filter defaults', () => {
  assert.deepEqual(defaultFilters(), {
    query: '',
    rating: 'any',
    watchType: 'any',
    year: 'any',
    decade: 'any',
    genre: 'any',
    minTmdbRating: 'any',
    sort: 'watched-desc',
    page: 1,
  })
})

test('parses shareable collection filter state from the URL', () => {
  const filters = parseProfileCollectionFilters(
    new URLSearchParams({
      q: 'alien',
      rating: '4.5',
      watchType: 'rewatch',
      year: '2026',
      decade: '1970',
      genre: '878',
      tmdbRating: '7',
      sort: 'rating-desc',
      page: '3',
      averageRating: 4.1,
      ratingCount: 120,
    })
  )

  assert.deepEqual(filters, {
    query: 'alien',
    rating: '4.5',
    watchType: 'rewatch',
    year: '2026',
    decade: '1970',
    genre: '878',
    minTmdbRating: '7',
    sort: 'rating-desc',
    page: 3,
  })
})

test('omits default collection state when serializing', () => {
  assert.equal(serializeProfileCollectionFilters(defaultFilters()).toString(), '')
})

test('serializes non-default collection state with stable parameter names', () => {
  const params = serializeProfileCollectionFilters({
    ...defaultFilters(),
    query: 'alien',
    watchType: 'rewatch',
    minTmdbRating: '7',
    sort: 'rating-desc',
    page: 2,
  })

  assert.equal(params.toString(), 'q=alien&watchType=rewatch&tmdbRating=7&sort=rating-desc&page=2')
})

test('movie watch type and watched year must match the same watch event', () => {
  const item = {
    ...alien,
    watchEvents: [
      {
        id: 'first',
        watchedAt: '2026-01-01T12:00:00.000Z',
        watchType: 'first-time',
      },
      {
        id: 'rewatch',
        watchedAt: '2025-01-01T12:00:00.000Z',
        watchType: 'rewatch',
      },
    ],
  }

  const result = filterAndSortProfileCollection(
    [item],
    {
      ...defaultFilters(),
      watchType: 'rewatch',
      year: '2026',
    },
    'movie'
  )

  assert.deepEqual(result, [])
})

test('series rewatch requires a second complete-series pass', () => {
  const once = {
    ...alien,
    id: 'watched-once',
    seriesPasses: [
      {
        passNumber: 1,
        completedAt: '2025-01-03T12:00:00.000Z',
      },
    ],
  }

  const rewatched = {
    ...alien,
    id: 'rewatched-series',
    seriesPasses: [
      {
        passNumber: 1,
        completedAt: '2025-01-03T12:00:00.000Z',
      },
      {
        passNumber: 2,
        completedAt: '2026-02-03T12:00:00.000Z',
      },
    ],
  }

  const result = filterAndSortProfileCollection(
    [once, rewatched],
    {
      ...defaultFilters(),
      watchType: 'rewatch',
    },
    'tv'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['rewatched-series']
  )
})

test('series rewatch year must match a second-or-later complete pass', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'rewatched-in-2026',
        seriesPasses: [
          {
            passNumber: 1,
            completedAt: '2025-01-03T12:00:00.000Z',
          },
          {
            passNumber: 2,
            completedAt: '2026-02-03T12:00:00.000Z',
          },
        ],
      },
      {
        ...alien,
        id: 'first-pass-only-in-2026',
        seriesPasses: [
          {
            passNumber: 1,
            completedAt: '2026-03-03T12:00:00.000Z',
          },
        ],
      },
    ],
    {
      ...defaultFilters(),
      watchType: 'rewatch',
      year: '2026',
    },
    'tv'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['rewatched-in-2026']
  )
})

test('series first-time year matches the first complete-series pass', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'first-completed-2025',
        seriesPasses: [
          {
            passNumber: 1,
            completedAt: '2025-04-03T12:00:00.000Z',
          },
          {
            passNumber: 2,
            completedAt: '2026-04-03T12:00:00.000Z',
          },
        ],
      },
      {
        ...alien,
        id: 'first-completed-2026',
        seriesPasses: [
          {
            passNumber: 1,
            completedAt: '2026-05-03T12:00:00.000Z',
          },
        ],
      },
    ],
    {
      ...defaultFilters(),
      watchType: 'first-time',
      year: '2026',
    },
    'tv'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['first-completed-2026']
  )
})

test('minimum TMDB rating is independent from the user rating', () => {
  const result = filterAndSortProfileCollection(
    [
      alien,
      {
        ...alien,
        id: 'lower-tmdb',
        userRating: 5,
        tmdbRating: 6.9,
      },
    ],
    {
      ...defaultFilters(),
      minTmdbRating: '7',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['alien']
  )
})

test('filters by release decade and genre', () => {
  const result = filterAndSortProfileCollection(
    [
      alien,
      {
        ...alien,
        id: 'arrival',
        title: 'Arrival',
        originalTitle: 'Arrival',
        releaseYear: 2016,
      },
    ],
    {
      ...defaultFilters(),
      decade: '1970',
      genre: '878',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['alien']
  )
})

test('search matches display title and original title case-insensitively', () => {
  const localized = {
    ...alien,
    id: 'localized-alien',
    title: 'O Oitavo Passageiro',
    originalTitle: 'Alien',
  }

  const unrelated = {
    ...alien,
    id: 'blade-runner',
    title: 'Blade Runner',
    originalTitle: 'Blade Runner',
  }

  assert.deepEqual(
    filterAndSortProfileCollection(
      [localized, unrelated],
      { ...defaultFilters(), query: 'ALIEN' },
      'movie'
    ).map((item) => item.id),
    ['localized-alien']
  )

  assert.deepEqual(
    filterAndSortProfileCollection(
      [localized, unrelated],
      { ...defaultFilters(), query: 'OITAVO' },
      'movie'
    ).map((item) => item.id),
    ['localized-alien']
  )
})

test('includes collection items matched by their current localized TMDb title', () => {
  const notebook = {
    ...alien,
    id: 'the-notebook',
    tmdbId: 11036,
    title: 'The Notebook',
    originalTitle: 'The Notebook',
  }

  const filters = {
    ...defaultFilters(),
    query: 'Diário de uma Paixão',
  }

  const results = filterAndSortProfileCollection([notebook], filters, 'movie', new Set([11036]))

  assert.deepEqual(
    results.map((item) => item.id),
    ['the-notebook']
  )
})

test('filters by the user rating independently from the TMDB rating', () => {
  const result = filterAndSortProfileCollection(
    [
      alien,
      {
        ...alien,
        id: 'five-stars',
        userRating: 5,
        tmdbRating: 6.5,
      },
    ],
    {
      ...defaultFilters(),
      rating: '5',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['five-stars']
  )
})

test('sorts by latest watched date descending by default', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'older',
        latestWatchedAt: '2025-01-01T12:00:00.000Z',
      },
      {
        ...alien,
        id: 'newer',
        latestWatchedAt: '2026-01-01T12:00:00.000Z',
      },
    ],
    defaultFilters(),
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['newer', 'older']
  )
})

test('sorts by user rating descending', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'lower-rating',
        userRating: 3,
      },
      {
        ...alien,
        id: 'higher-rating',
        userRating: 4.5,
      },
    ],
    {
      ...defaultFilters(),
      sort: 'rating-desc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['higher-rating', 'lower-rating']
  )
})

test('sorts by latest activity descending', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'older-activity',
        latestActivityAt: '2025-01-01T12:00:00.000Z',
      },
      {
        ...alien,
        id: 'newer-activity',
        latestActivityAt: '2026-01-01T12:00:00.000Z',
      },
    ],
    {
      ...defaultFilters(),
      sort: 'activity-desc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['newer-activity', 'older-activity']
  )
})

test('sorts by diary count descending', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'less-watched',
        watchCount: 1,
      },
      {
        ...alien,
        id: 'more-watched',
        watchCount: 4,
      },
    ],
    {
      ...defaultFilters(),
      sort: 'count-desc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['more-watched', 'less-watched']
  )
})

test('sorts titles ascending', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'zodiac',
        title: 'Zodiac',
      },
      {
        ...alien,
        id: 'alien-title',
        title: 'Alien',
      },
    ],
    {
      ...defaultFilters(),
      sort: 'title-asc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['alien-title', 'zodiac']
  )
})

test('sorts popularity by community rating count', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'less-popular',
        ratingCount: 10,
      },
      {
        ...alien,
        id: 'more-popular',
        ratingCount: 200,
      },
    ],
    {
      ...defaultFilters(),
      sort: 'popularity-desc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['more-popular', 'less-popular']
  )
})

test('sorts by release year descending', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'older-release',
        releaseYear: 1979,
      },
      {
        ...alien,
        id: 'newer-release',
        releaseYear: 2024,
      },
    ],
    {
      ...defaultFilters(),
      sort: 'release-desc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['newer-release', 'older-release']
  )
})

test('sorts by community average rating descending', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'lower-average',
        averageRating: 3.2,
      },
      {
        ...alien,
        id: 'higher-average',
        averageRating: 4.6,
      },
    ],
    {
      ...defaultFilters(),
      sort: 'average-desc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['higher-average', 'lower-average']
  )
})

test('sorts by runtime descending', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'shorter',
        runtimeMinutes: 90,
      },
      {
        ...alien,
        id: 'longer',
        runtimeMinutes: 180,
      },
    ],
    {
      ...defaultFilters(),
      sort: 'runtime-desc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['longer', 'shorter']
  )
})

test('supports ascending sort direction', () => {
  const result = filterAndSortProfileCollection(
    [
      {
        ...alien,
        id: 'higher-rating',
        userRating: 4.5,
      },
      {
        ...alien,
        id: 'lower-rating',
        userRating: 2.5,
      },
    ],
    {
      ...defaultFilters(),
      sort: 'rating-asc',
    },
    'movie'
  )

  assert.deepEqual(
    result.map((item) => item.id),
    ['lower-rating', 'higher-rating']
  )
})

test('paginates deterministically and clamps the requested page', () => {
  assert.deepEqual(paginateProfileCollection([1, 2, 3, 4, 5], 2, 2), {
    items: [3, 4],
    page: 2,
    totalItems: 5,
    totalPages: 3,
  })

  assert.deepEqual(paginateProfileCollection([1, 2, 3], 99, 2), {
    items: [3],
    page: 2,
    totalItems: 3,
    totalPages: 2,
  })
})

test('counts only active collection filters and ignores sort and page', () => {
  assert.equal(
    typeof countActiveProfileCollectionFilters,
    'function',
    'countActiveProfileCollectionFilters should be exported'
  )

  assert.equal(
    countActiveProfileCollectionFilters({
      ...DEFAULT_PROFILE_COLLECTION_FILTERS,
      query: '  alien  ',
      rating: '4',
      watchType: 'rewatch',
      year: '2026',
      decade: '2020',
      genre: '18',
      minTmdbRating: '7',
      sort: 'title-asc',
      page: 4,
    }),
    7
  )

  assert.equal(
    countActiveProfileCollectionFilters({
      ...DEFAULT_PROFILE_COLLECTION_FILTERS,
      query: '   ',
      sort: 'title-asc',
      page: 3,
    }),
    0
  )
})
