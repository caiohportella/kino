import assert from 'node:assert/strict'
import test from 'node:test'
import {
  profileQueryKeys,
  searchQueryKeys,
  titleQueryKeys,
  watchlistQueryKeys,
} from './query-keys.ts'

const publicScope = { kind: 'public' }

test('builds the literal versioned localized title details key', () => {
  assert.deepEqual(
    titleQueryKeys.details({
      id: 238,
      mediaType: 'movie',
      locale: 'pt-BR',
      region: 'BR',
      scope: publicScope,
    }),
    ['v1', 'title', 'details', 'movie', 238, 'pt-BR', 'BR', 'public']
  )
})

test('normalizes locale and region while isolating authenticated users', () => {
  const first = titleQueryKeys.summary({
    id: 1396,
    mediaType: 'tv',
    locale: 'PT_br',
    region: 'br',
    scope: { kind: 'authenticated', userId: ' user-a ' },
  })
  const second = titleQueryKeys.summary({
    id: 1396,
    mediaType: 'tv',
    locale: 'pt-BR',
    region: 'BR',
    scope: { kind: 'authenticated', userId: 'user-b' },
  })

  assert.deepEqual(first, [
    'v1',
    'title',
    'summary',
    'tv',
    1396,
    'pt-BR',
    'BR',
    'authenticated',
    'user-a',
  ])
  assert.notDeepEqual(first, second)
  assert.throws(
    () =>
      titleQueryKeys.details({
        id: 238,
        mediaType: 'movie',
        locale: 'en-US',
        region: 'US',
        scope: { kind: 'authenticated', userId: ' ' },
      }),
    /user id/i
  )
})

test('separates title resources and exposes factory prefixes for invalidation', () => {
  assert.deepEqual(titleQueryKeys.all, ['v1', 'title'])
  assert.deepEqual(titleQueryKeys.summaries(), ['v1', 'title', 'summary'])
  assert.deepEqual(titleQueryKeys.detailsRoot(), ['v1', 'title', 'details'])

  const input = {
    id: 238,
    mediaType: 'movie',
    locale: 'en-US',
    region: 'US',
    scope: publicScope,
  }
  assert.notDeepEqual(titleQueryKeys.summary(input), titleQueryKeys.details(input))
})

test('search keys isolate normalized query, page, filters, locale, region, and scope', () => {
  const filters = {
    genres: ['drama', 'crime'],
    includeAdult: false,
    year: 1972,
  }
  const first = searchQueryKeys.results({
    filters,
    locale: 'pt-br',
    page: 2,
    query: '  The   Godfather ',
    region: 'br',
    scope: publicScope,
  })
  const reordered = searchQueryKeys.results({
    filters: {
      year: 1972,
      includeAdult: false,
      genres: ['drama', 'crime'],
    },
    locale: 'pt-BR',
    page: 2,
    query: 'The Godfather',
    region: 'BR',
    scope: publicScope,
  })

  assert.deepEqual(first, [
    'v1',
    'search',
    'results',
    'The Godfather',
    'pt-BR',
    'BR',
    'public',
    2,
    { genres: ['drama', 'crime'], includeAdult: false, year: 1972 },
  ])
  assert.deepEqual(first, reordered)
  assert.notDeepEqual(first, searchQueryKeys.results({ ...reorderedInput(reordered), page: 3 }))
})

test('profile and watchlist keys keep public and authenticated data separate', () => {
  assert.deepEqual(
    profileQueryKeys.details({
      profileId: 'profile-a',
      scope: publicScope,
    }),
    ['v1', 'profile', 'details', 'profile-a', 'public']
  )
  assert.deepEqual(
    watchlistQueryKeys.items({
      listId: 'list-a',
      page: 1,
      scope: { kind: 'authenticated', userId: 'viewer-a' },
    }),
    ['v1', 'watchlist', 'items', 'list-a', 'authenticated', 'viewer-a', 1]
  )
})

test('resolves a normalized username before using the canonical profile identifier downstream', () => {
  assert.deepEqual(profileQueryKeys.usernameResolution('  KinoFan  '), [
    'v1',
    'profile',
    'username-resolution',
    'kinofan',
  ])

  const beforeUsernameChange = profileQueryKeys.identity({
    profileId: 'profile-immutable-id',
    visibilityScope: publicScope,
  })
  const afterUsernameChange = profileQueryKeys.identity({
    profileId: 'profile-immutable-id',
    visibilityScope: publicScope,
  })

  assert.deepEqual(beforeUsernameChange, [
    'v1',
    'profile',
    'identity',
    'profile-immutable-id',
    'public',
  ])
  assert.deepEqual(beforeUsernameChange, afterUsernameChange)
  assert.notDeepEqual(
    profileQueryKeys.usernameResolution('before-rename'),
    profileQueryKeys.usernameResolution('after-rename')
  )
})

test('isolates canonical profile sections by profile, viewer, scope, page, filters, and locale region', () => {
  const profileId = 'profile-a'
  const visibilityScope = { kind: 'authenticated', userId: 'profile-viewer' }
  const pageAndFilters = { filters: { mediaType: 'movie', year: 2026 }, page: 2 }

  assert.deepEqual(
    profileQueryKeys.relationship({ profileId, viewerId: 'viewer-a' }),
    ['v1', 'profile', 'relationship', 'profile-a', 'viewer-a']
  )
  assert.notDeepEqual(
    profileQueryKeys.relationship({ profileId, viewerId: 'viewer-a' }),
    profileQueryKeys.relationship({ profileId, viewerId: 'viewer-b' })
  )

  for (const section of [
    profileQueryKeys.watchedMovies,
    profileQueryKeys.watchedSeries,
    profileQueryKeys.watchlists,
    profileQueryKeys.reviews,
    profileQueryKeys.ratings,
  ]) {
    const first = section({ profileId, visibilityScope, ...pageAndFilters })
    assert.equal(first[0], 'v1')
    assert.equal(first[3], profileId)
    assert.notDeepEqual(
      first,
      section({ profileId: 'profile-b', visibilityScope, ...pageAndFilters })
    )
    assert.notDeepEqual(first, section({ profileId, visibilityScope, filters: {}, page: 3 }))
  }

  const publicWatchedMovies = profileQueryKeys.watchedMovies({
    profileId,
    visibilityScope: publicScope,
    ...pageAndFilters,
  })
  const authenticatedWatchedMovies = profileQueryKeys.watchedMovies({
    profileId,
    visibilityScope,
    ...pageAndFilters,
  })
  assert.notDeepEqual(publicWatchedMovies, authenticatedWatchedMovies)
  assert.notDeepEqual(
    authenticatedWatchedMovies,
    profileQueryKeys.watchedMovies({
      profileId,
      visibilityScope: { kind: 'authenticated', userId: 'another-profile-viewer' },
      ...pageAndFilters,
    })
  )

  assert.deepEqual(
    profileQueryKeys.statistics({ profileId, visibilityScope }),
    ['v1', 'profile', 'statistics', 'profile-a', 'authenticated', 'profile-viewer']
  )

  const availability = profileQueryKeys.availability({
    filters: { season: 2 },
    locale: 'pt_br',
    mediaType: 'tv',
    page: 2,
    profileId,
    region: 'br',
    seasonNumber: 2,
    titleId: 1396,
    visibilityScope,
  })
  assert.deepEqual(availability, [
    'v1',
    'profile',
    'availability',
    'profile-a',
    'tv',
    1396,
    2,
    'pt-BR',
    'BR',
    'authenticated',
    'profile-viewer',
    2,
    { season: 2 },
  ])
  assert.notDeepEqual(
    availability,
    profileQueryKeys.availability({
      filters: { season: 2 },
      locale: 'en-US',
      mediaType: 'tv',
      page: 2,
      profileId,
      region: 'US',
      seasonNumber: 2,
      titleId: 1396,
      visibilityScope,
    })
  )
  assert.notDeepEqual(
    availability,
    profileQueryKeys.availability({
      filters: { season: 2 },
      locale: 'pt-BR',
      mediaType: 'tv',
      page: 2,
      profileId,
      region: 'BR',
      seasonNumber: 2,
      titleId: 66732,
      visibilityScope,
    })
  )
})

function reorderedInput(key) {
  return {
    filters: key.at(-1),
    locale: key[4],
    query: key[3],
    region: key[5],
    scope: publicScope,
  }
}
