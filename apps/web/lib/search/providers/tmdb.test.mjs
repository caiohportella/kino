import assert from 'node:assert/strict'
import test from 'node:test'

import { createTmdbSearchProvider } from './tmdb.ts'

const movie = {
  id: 238,
  media_type: 'movie',
  title: 'The Godfather',
  original_title: 'The Godfather',
  overview: 'An organized crime dynasty changes hands.',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  release_date: '1972-03-14',
  genre_ids: [18, 80],
  original_language: 'en',
  popularity: 170.5,
  vote_average: 8.7,
  vote_count: 20_798,
  adult: false,
  video: false,
}

const person = {
  id: 3084,
  media_type: 'person',
  name: 'Marlon Brando',
  original_name: 'Marlon Brando',
  profile_path: '/brando.jpg',
  known_for_department: 'Acting',
  popularity: 40.2,
  adult: false,
  gender: 2,
  known_for: [movie],
}

test('normalizes complete TMDB multi-search results into core candidates', async () => {
  const requests = []
  const provider = createTmdbSearchProvider({
    apiKey: 'tmdb-server-key',
    fetch: async (url, init) => {
      requests.push({ url: new URL(url), init })
      return Response.json({
        page: 1,
        results: [movie, person, { ...movie, id: 9, media_type: 'collection' }],
        total_pages: 1,
        total_results: 3,
      })
    },
  })

  const result = await provider.search(
    {
      query: 'The Godfather',
      locale: 'pt-BR',
      region: 'BR',
      page: 1,
      mediaTypes: ['movie'],
    },
    undefined
  )

  assert.deepEqual(result, {
    sourceId: 'tmdb',
    candidates: [
      {
        source: 'lexical',
        lexicalScore: 1,
        exactMatch: true,
        entity: {
          id: 'movie:238',
          entityType: 'movie',
          tmdbId: 238,
          title: 'The Godfather',
          summary: 'An organized crime dynasty changes hands.',
          imageUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          year: 1972,
          locale: 'pt-BR',
          popularity: 170.5,
          voteCount: 20_798,
        },
      },
      {
        source: 'person',
        confidence: 0.85,
        entity: {
          id: 'person:3084',
          entityType: 'person',
          tmdbId: 3084,
          title: 'Marlon Brando',
          imageUrl: 'https://image.tmdb.org/t/p/w500/brando.jpg',
          locale: 'pt-BR',
          popularity: 40.2,
        },
      },
    ],
  })
  assert.equal(requests[0].url.pathname, '/3/search/multi')
  assert.equal(requests[0].url.searchParams.get('language'), 'pt-BR')
  assert.equal(requests[0].url.searchParams.get('region'), 'BR')
  assert.equal(requests[0].url.searchParams.get('api_key'), 'tmdb-server-key')
  assert.equal(requests[0].url.searchParams.get('page'), '1')
})

test('retrieves the full TMDB window from page one so shared core owns page two pagination', async () => {
  const pages = []
  const provider = createTmdbSearchProvider({
    apiKey: 'tmdb-server-key',
    fetch: async (url) => {
      const page = Number(new URL(url).searchParams.get('page'))
      pages.push(String(page))
      return Response.json({
        page,
        results: Array.from({ length: 20 }, (_, index) => ({
          ...movie,
          id: (page - 1) * 20 + index + 1,
          title: `Movie ${(page - 1) * 20 + index + 1}`,
        })),
        total_pages: 3,
        total_results: 60,
      })
    },
  })

  const result = await provider.search({ query: 'Godfather', page: 1, limit: 40 })
  assert.deepEqual(pages, ['1', '2'])
  assert.equal(result.candidates.length, 40)
})

test('passes caller cancellation to TMDB without wrapping AbortError', async () => {
  const controller = new AbortController()
  const provider = createTmdbSearchProvider({
    apiKey: 'tmdb-server-key',
    fetch: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      }),
  })

  const pending = provider.search({ query: 'Alien' }, controller.signal)
  const reason = new DOMException('cancelled', 'AbortError')
  controller.abort(reason)
  await assert.rejects(pending, (error) => error === reason)
})

test('rejects malformed TMDB payloads with a platform-neutral provider error', async () => {
  const provider = createTmdbSearchProvider({
    apiKey: 'tmdb-server-key',
    fetch: async () => Response.json({ results: 'not-an-array', token: 'must-not-leak' }),
  })

  await assert.rejects(
    provider.search({ query: 'Alien' }),
    (error) =>
      error.code === 'provider_response_invalid' &&
      error.message === 'Search provider returned an invalid response'
  )
})

test('normalizes person cast and crew credits for shared person expansion', async () => {
  const provider = createTmdbSearchProvider({
    apiKey: 'tmdb-server-key',
    fetch: async (url) => {
      assert.equal(new URL(url).pathname, '/3/person/3084/combined_credits')
      return Response.json({
        id: 3084,
        cast: [
          {
            ...movie,
            character: 'Don Vito Corleone',
            credit_id: 'credit-cast',
            order: 0,
          },
        ],
        crew: [
          {
            id: 10,
            media_type: 'tv',
            name: 'Directed Series',
            original_name: 'Directed Series',
            overview: '',
            poster_path: null,
            backdrop_path: null,
            first_air_date: '1980-01-01',
            genre_ids: [],
            original_language: 'en',
            popularity: 1,
            vote_average: 7,
            vote_count: 10,
            adult: false,
            job: 'Director',
            department: 'Directing',
            credit_id: 'credit-crew',
          },
        ],
      })
    },
  })

  assert.deepEqual(await provider.getPersonCredits(3084), [
    {
      entity: {
        id: 'movie:238',
        entityType: 'movie',
        tmdbId: 238,
        title: 'The Godfather',
        year: 1972,
      },
      role: 'acting',
      castOrder: 0,
    },
    {
      entity: {
        id: 'series:10',
        entityType: 'series',
        tmdbId: 10,
        title: 'Directed Series',
        year: 1980,
      },
      role: 'directing',
    },
  ])
})

test('resolves locale-sensitive media presentation without changing entity identity', async () => {
  const provider = createTmdbSearchProvider({
    apiKey: 'tmdb-server-key',
    fetch: async (url) => {
      const requestUrl = new URL(url)
      assert.equal(requestUrl.pathname, '/3/movie/238')
      assert.equal(requestUrl.searchParams.get('language'), 'pt-BR')
      assert.equal(requestUrl.searchParams.get('region'), 'BR')
      return Response.json({
        ...movie,
        title: 'O Poderoso Chefão',
        overview: 'A família Corleone muda de mãos.',
        poster_path: '/poster-pt.jpg',
      })
    },
  })

  const entity = {
    id: 'movie:238',
    entityType: 'movie',
    tmdbId: 238,
    title: 'The Godfather',
  }
  assert.deepEqual(await provider.resolvePresentation(entity, { locale: 'pt-BR', region: 'BR' }), {
    id: 'movie:238',
    entityType: 'movie',
    tmdbId: 238,
    title: 'O Poderoso Chefão',
    summary: 'A família Corleone muda de mãos.',
    imageUrl: 'https://image.tmdb.org/t/p/w500/poster-pt.jpg',
    year: 1972,
    locale: 'pt-BR',
    popularity: 170.5,
    voteCount: 20_798,
  })
})
