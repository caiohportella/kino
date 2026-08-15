import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeFranchiseTitles,
  normalizeWatchProviders,
  resolveWatchProviderRegion,
  selectPreferredTrailer,
} from '@kino/core'

test('normalizeFranchiseTitles excludes the current title, deduplicates, and sorts dates first', () => {
  const part = (id, release_date) => ({
    id,
    title: `Movie ${id}`,
    overview: '',
    poster_path: null,
    backdrop_path: null,
    release_date,
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
  })
  const normalized = normalizeFranchiseTitles(
    [part(2, ''), part(1, '2020-01-01'), part(3, '2010-01-01'), part(3, '2010-01-01')],
    1
  )
  assert.deepEqual(
    normalized.map((item) => item.id),
    [3, 2]
  )
  assert.equal(
    normalized.every((item) => item.media_type === 'movie'),
    true
  )
})

const video = (overrides = {}) => ({
  id: crypto.randomUUID(),
  iso_639_1: 'en',
  iso_3166_1: 'US',
  key: 'youtube-key',
  name: 'Video',
  official: false,
  published_at: '2025-01-01T00:00:00Z',
  site: 'YouTube',
  type: 'Trailer',
  ...overrides,
})

test('selectPreferredTrailer prefers official trailers and the active language', () => {
  const selected = selectPreferredTrailer(
    [
      video({ id: 'unofficial' }),
      video({ id: 'official-en', official: true }),
      video({ id: 'official-pt', official: true, iso_639_1: 'pt' }),
    ],
    'pt-BR'
  )
  assert.equal(selected?.id, 'official-pt')
})

test('selectPreferredTrailer falls back from trailer to teaser, clip, then YouTube video', () => {
  assert.equal(
    selectPreferredTrailer(
      [
        video({ id: 'other', type: 'Featurette' }),
        video({ id: 'clip', type: 'Clip' }),
        video({ id: 'teaser', type: 'Teaser' }),
      ],
      'en-US'
    )?.id,
    'teaser'
  )
  assert.equal(selectPreferredTrailer([video({ site: 'Vimeo' })], 'en-US'), null)
  assert.equal(selectPreferredTrailer([], 'en-US'), null)
})

test('resolveWatchProviderRegion follows stored, locale, default, and US priority', () => {
  assert.equal(
    resolveWatchProviderRegion({ storedRegion: 'br', locale: 'en-US', defaultRegion: 'CA' }),
    'BR'
  )
  assert.equal(resolveWatchProviderRegion({ locale: 'fr-FR', defaultRegion: 'CA' }), 'FR')
  assert.equal(resolveWatchProviderRegion({ locale: 'de', defaultRegion: 'DE' }), 'DE')
  assert.equal(resolveWatchProviderRegion({ locale: 'xx' }), 'US')
})

test('normalizeWatchProviders groups, deduplicates, and sorts providers', () => {
  const normalized = normalizeWatchProviders(
    {
      id: 1,
      results: {
        BR: {
          link: 'https://www.themoviedb.org/watch',
          flatrate: [
            {
              display_priority: 10,
              logo_path: null,
              provider_id: 2,
              provider_name: 'Second',
            },
            {
              display_priority: 1,
              logo_path: '/first.jpg',
              provider_id: 1,
              provider_name: 'First',
            },
            {
              display_priority: 3,
              logo_path: '/duplicate.jpg',
              provider_id: 1,
              provider_name: 'First duplicate',
            },
          ],
          rent: [
            {
              display_priority: 2,
              logo_path: null,
              provider_id: 1,
              provider_name: 'First',
            },
          ],
        },
      },
    },
    'br'
  )

  assert.deepEqual(
    normalized.groups.stream?.map((provider) => provider.provider_id),
    [1, 2]
  )
  assert.equal(normalized.groups.rent?.[0].category, 'rent')
  assert.equal(normalized.link, 'https://www.themoviedb.org/watch')
})

test('normalizeWatchProviders handles missing regions and empty API responses', () => {
  assert.deepEqual(normalizeWatchProviders({ id: 1, results: {} }, 'BR'), {
    groups: {},
    link: null,
    region: 'BR',
  })
})
