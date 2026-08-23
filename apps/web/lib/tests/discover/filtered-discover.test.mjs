import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchFilteredDiscoverMorePage } from '../../discover/filtered-more-query.ts'
import { fetchFilteredDiscoverRows } from '../../discover/filtered-row-query.ts'
import {
  createDiscoverFilterParams,
  createDiscoverStrategyParams,
  mediaIdentity,
  mergeBalancedMediaResults,
  takeUniqueResults,
} from '../../discover/filtered-rows.ts'

function title(id, mediaType = 'movie', overrides = {}) {
  return {
    id,
    media_type: mediaType,
    title: `Title ${id}`,
    name: `Title ${id}`,
    vote_average: 7,
    vote_count: 100,
    popularity: 50,
    ...overrides,
  }
}

test('filter params include genres and minimum rating without adding presentation-specific sorting', () => {
  assert.deepEqual(
    createDiscoverFilterParams({
      mediaType: 'movie',
      genreIds: [27, 12],
      minRating: 7,
    }),
    {
      with_genres: '12,27',
      'vote_average.gte': '7',
    }
  )
})

test('best matches uses established-title ranking', () => {
  assert.deepEqual(
    createDiscoverStrategyParams({
      filters: {
        mediaType: 'movie',
        genreIds: [27],
        minRating: 7,
      },
      strategy: 'best-matches',
      type: 'movie',
    }),
    {
      with_genres: '27',
      'vote_average.gte': '7',
      page: '1',
      sort_by: 'vote_count.desc',
      'vote_count.gte': '100',
    }
  )
})

test('popular uses popularity descending while preserving filters', () => {
  assert.deepEqual(
    createDiscoverStrategyParams({
      filters: {
        mediaType: 'movie',
        genreIds: [27],
        minRating: 6,
      },
      strategy: 'popular',
      type: 'movie',
    }),
    {
      with_genres: '27',
      'vote_average.gte': '6',
      page: '1',
      sort_by: 'popularity.desc',
    }
  )
})

test('highly rated sorts descending and requires a meaningful vote sample', () => {
  assert.deepEqual(
    createDiscoverStrategyParams({
      filters: {
        mediaType: 'tv',
        genreIds: [],
        minRating: 8,
      },
      strategy: 'highly-rated',
      type: 'tv',
    }),
    {
      'vote_average.gte': '8',
      page: '1',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '250',
    }
  )
})

test('recent movie results are capped at today and use movie release date sorting', () => {
  const params = createDiscoverStrategyParams({
    filters: {
      mediaType: 'movie',
      genreIds: [],
      minRating: 0,
    },
    strategy: 'recent',
    type: 'movie',
  })

  assert.equal(params.sort_by, 'primary_release_date.desc')
  assert.equal(params['vote_count.gte'], '20')
  assert.match(params['primary_release_date.lte'], /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(params['first_air_date.lte'], undefined)
})

test('recent tv results are capped at today and use first air date sorting', () => {
  const params = createDiscoverStrategyParams({
    filters: {
      mediaType: 'tv',
      genreIds: [],
      minRating: 0,
    },
    strategy: 'recent',
    type: 'tv',
  })

  assert.equal(params.sort_by, 'first_air_date.desc')
  assert.equal(params['vote_count.gte'], '20')
  assert.match(params['first_air_date.lte'], /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(params['primary_release_date.lte'], undefined)
})

test('movie and tv results are interleaved when media type is all', () => {
  const movies = [title(1, 'movie'), title(2, 'movie')]
  const tv = [title(10, 'tv'), title(11, 'tv'), title(12, 'tv')]

  const merged = mergeBalancedMediaResults(movies, tv)

  assert.deepEqual(merged.map(mediaIdentity), ['movie-1', 'tv-10', 'movie-2', 'tv-11', 'tv-12'])
})

test('takeUniqueResults excludes already-seen titles and respects its limit', () => {
  const seen = new Set(['movie-1'])

  const result = takeUniqueResults([title(1), title(2), title(2), title(3), title(4)], seen, 2)

  assert.deepEqual(result.map(mediaIdentity), ['movie-2', 'movie-3'])

  assert.equal(seen.has('movie-1'), true)
  assert.equal(seen.has('movie-2'), true)
  assert.equal(seen.has('movie-3'), true)
})

test('same numeric id from movie and tv are different media identities', () => {
  assert.notEqual(mediaIdentity(title(123, 'movie')), mediaIdentity(title(123, 'tv')))
})

test('filtered rows fetch semantic strategies in parallel and deduplicate progressively', async () => {
  const calls = []

  const pools = {
    'vote_count.desc': [title(1), title(2), title(3), title(4), title(5), title(6)],

    'popularity.desc': [
      title(1),
      title(2),
      title(7),
      title(8),
      title(9),
      title(10),
      title(11),
      title(12),
    ],

    'primary_release_date.desc': [
      title(3),
      title(4),
      title(13),
      title(14),
      title(15),
      title(16),
      title(17),
      title(18),
    ],

    'vote_average.desc': [
      title(5),
      title(6),
      title(19),
      title(20),
      title(21),
      title(22),
      title(23),
      title(24),
    ],
  }

  const tmdb = {
    async discoverMedia(type, params) {
      calls.push({
        type,
        params,
      })

      return {
        results: pools[params.sort_by] ?? [],
        totalPages: 10,
        totalResults: 200,
      }
    },
  }

  const rows = await fetchFilteredDiscoverRows({
    tmdb,
    filters: {
      mediaType: 'movie',
      genreIds: [],
      minRating: 0,
    },
  })

  assert.equal(calls.length, 4)

  assert.deepEqual(
    rows.map((row) => row.id),
    ['best-matches', 'popular', 'recent', 'highly-rated']
  )

  const allIds = rows.flatMap((row) => row.items.map(mediaIdentity))

  assert.equal(
    new Set(allIds).size,
    allIds.length,
    'titles should not repeat between semantic rows'
  )
})

test('rows containing fewer than four unique results are omitted', async () => {
  const tmdb = {
    async discoverMedia(_type, params) {
      if (params.sort_by === 'vote_count.desc') {
        return {
          results: [title(1), title(2), title(3), title(4)],
          totalPages: 1,
          totalResults: 4,
        }
      }

      return {
        results: [title(1), title(2), title(5)],
        totalPages: 1,
        totalResults: 3,
      }
    },
  }

  const rows = await fetchFilteredDiscoverRows({
    tmdb,
    filters: {
      mediaType: 'movie',
      genreIds: [],
      minRating: 0,
    },
  })

  assert.deepEqual(
    rows.map((row) => row.id),
    ['best-matches']
  )
})

test('more to discover starts from the requested page and reports whether another page exists', async () => {
  const calls = []

  const tmdb = {
    async discoverMedia(type, params) {
      calls.push({
        type,
        params,
      })

      return {
        results: [title(21, type), title(22, type)],
        totalPages: 4,
        totalResults: 80,
      }
    },
  }

  const result = await fetchFilteredDiscoverMorePage({
    tmdb,
    filters: {
      mediaType: 'movie',
      genreIds: [27],
      minRating: 7,
    },
    page: 2,
  })

  assert.equal(result.page, 2)
  assert.equal(result.hasMore, true)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].params.page, '2')
  assert.equal(calls[0].params.with_genres, '27')
  assert.equal(calls[0].params['vote_average.gte'], '7')
})

test('mixed more-to-discover results balance movies and tv and use the largest remaining page count', async () => {
  const tmdb = {
    async discoverMedia(type) {
      if (type === 'movie') {
        return {
          results: [title(1, 'movie'), title(2, 'movie')],
          totalPages: 2,
          totalResults: 40,
        }
      }

      return {
        results: [title(10, 'tv'), title(11, 'tv')],
        totalPages: 5,
        totalResults: 100,
      }
    },
  }

  const result = await fetchFilteredDiscoverMorePage({
    tmdb,
    filters: {
      mediaType: 'all',
      genreIds: [],
      minRating: 0,
    },
    page: 2,
  })

  assert.deepEqual(result.items.map(mediaIdentity), ['movie-1', 'tv-10', 'movie-2', 'tv-11'])

  assert.equal(result.hasMore, true)
})
