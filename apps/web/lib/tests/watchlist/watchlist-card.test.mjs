import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyLocalizedWatchlistPreviewTitle,
  applyLocalizedWatchlistPreviewTitles,
  getWatchlistLastAddedPresentation,
  getWatchlistParticipantPreview,
  resolveWatchlistLastItemAddedAt,
} from '../../watchlist/watchlist-card.ts'

const participants = [
  { id: '1', username: 'caio' },
  { id: '2', username: 'alice' },
  { id: '3', username: 'bob' },
  { id: '4', username: 'charlie' },
  { id: '5', username: 'diana' },
]

test('does not show participant avatars for the owner alone', () => {
  const result = getWatchlistParticipantPreview(participants.slice(0, 1))

  assert.equal(result.mode, 'none')
  assert.deepEqual(result.visibleParticipants, [])
  assert.equal(result.remainingCount, 0)
})

test('shows both participants separately for owner plus one collaborator', () => {
  const result = getWatchlistParticipantPreview(participants.slice(0, 2))

  assert.equal(result.mode, 'pair')
  assert.deepEqual(result.visibleParticipants, participants.slice(0, 2))
  assert.equal(result.remainingCount, 0)
})

test('uses a grouped preview when there are more than two participants', () => {
  const result = getWatchlistParticipantPreview(participants)

  assert.equal(result.mode, 'group')
  assert.deepEqual(result.visibleParticipants, participants.slice(0, 2))
  assert.equal(result.remainingCount, 3)
})

test('returns the newest item-added date', () => {
  const result = resolveWatchlistLastItemAddedAt([
    { added_at: '2026-08-12T12:00:00.000Z' },
    { added_at: '2026-08-20T15:00:00.000Z' },
    { added_at: '2026-08-18T10:00:00.000Z' },
  ])

  assert.deepEqual(result, new Date('2026-08-20T15:00:00.000Z'))
})

test('returns undefined when the watchlist has no items', () => {
  assert.equal(resolveWatchlistLastItemAddedAt([]), undefined)
})

test('shows hours ago when the last item was added today', () => {
  const now = new Date(2026, 7, 20, 17, 0)
  const addedAt = new Date(2026, 7, 20, 14, 0)

  assert.deepEqual(getWatchlistLastAddedPresentation(addedAt, now), {
    kind: 'hoursAgo',
    hours: 3,
  })
})

test('shows less than one hour when added today within the last hour', () => {
  const now = new Date(2026, 7, 20, 17, 0)
  const addedAt = new Date(2026, 7, 20, 16, 45)

  assert.deepEqual(getWatchlistLastAddedPresentation(addedAt, now), {
    kind: 'lessThanHour',
  })
})

test('omits the year when the last item was added earlier this year', () => {
  const now = new Date(2026, 7, 20, 17, 0)
  const addedAt = new Date(2026, 5, 12, 10, 0)

  assert.deepEqual(getWatchlistLastAddedPresentation(addedAt, now), {
    kind: 'date',
    date: '12/06',
  })
})

test('includes the year when the last item was added in another year', () => {
  const now = new Date(2026, 7, 20, 17, 0)
  const addedAt = new Date(2025, 11, 4, 10, 0)

  assert.deepEqual(getWatchlistLastAddedPresentation(addedAt, now), {
    kind: 'date',
    date: '04/12/2025',
  })
})

test('uses localized title and poster for a watchlist preview', () => {
  const preview = {
    id: 'title-1',
    tmdbId: 238,
    type: 'movie',
    title: 'The Godfather',
    coverImage: '/original.jpg',
    watched: false,
  }

  const result = applyLocalizedWatchlistPreviewTitle(
    preview,
    {
      title: 'O Poderoso Chefão',
      posterPath: '/pt-br.jpg',
    },
    (posterPath) => `https://image.tmdb.org/t/p/w500${posterPath}`
  )

  assert.deepEqual(result, {
    ...preview,
    title: 'O Poderoso Chefão',
    coverImage: 'https://image.tmdb.org/t/p/w500/pt-br.jpg',
  })
})

test('keeps persisted watchlist preview presentation when localization is unavailable', () => {
  const preview = {
    id: 'title-1',
    tmdbId: 238,
    type: 'movie',
    title: 'The Godfather',
    coverImage: '/original.jpg',
    watched: false,
  }

  const result = applyLocalizedWatchlistPreviewTitle(
    preview,
    undefined,
    (posterPath) => `https://image.tmdb.org/t/p/w500${posterPath}`
  )

  assert.deepEqual(result, preview)
})

test('applies one localized title batch across multiple watchlist previews', () => {
  const watchlists = [
    {
      id: 'watchlist-1',
      previewTitles: [
        {
          id: 'title-1',
          tmdbId: 238,
          type: 'movie',
          title: 'The Godfather',
          coverImage: '/stored-godfather.jpg',
          watched: false,
        },
      ],
    },
    {
      id: 'watchlist-2',
      previewTitles: [
        {
          id: 'title-2',
          tmdbId: 1396,
          type: 'tv',
          title: 'Breaking Bad',
          coverImage: '/stored-breaking-bad.jpg',
          watched: true,
        },
      ],
    },
  ]

  const result = applyLocalizedWatchlistPreviewTitles(
    watchlists,
    {
      'movie:238': {
        title: 'O Poderoso Chefão',
        posterPath: '/godfather-pt.jpg',
      },
      'tv:1396': {
        title: 'Breaking Bad',
        posterPath: '/breaking-bad-pt.jpg',
      },
    },
    (posterPath) => `https://image.tmdb.org/t/p/w500${posterPath}`
  )

  assert.equal(result[0].previewTitles[0].title, 'O Poderoso Chefão')

  assert.equal(
    result[0].previewTitles[0].coverImage,
    'https://image.tmdb.org/t/p/w500/godfather-pt.jpg'
  )

  assert.equal(
    result[1].previewTitles[0].coverImage,
    'https://image.tmdb.org/t/p/w500/breaking-bad-pt.jpg'
  )

  assert.equal(result[1].previewTitles[0].watched, true)
})

test('keeps persisted preview data when a title is absent from the localized batch', () => {
  const watchlists = [
    {
      id: 'watchlist-1',
      previewTitles: [
        {
          id: 'title-1',
          tmdbId: 238,
          type: 'movie',
          title: 'The Godfather',
          coverImage: '/stored.jpg',
          watched: false,
        },
      ],
    },
  ]

  const result = applyLocalizedWatchlistPreviewTitles(
    watchlists,
    {},
    (posterPath) => `https://image.tmdb.org/t/p/w500${posterPath}`
  )

  assert.deepEqual(result[0].previewTitles, watchlists[0].previewTitles)
})
