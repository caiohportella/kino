import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getReviewAuthorLabel,
  isValidHalfStepRating,
  mapFollowedEpisodeRatings,
  mapProfileReviewsPage,
  mapTitleReviewsPage,
  ratingKeys,
  reviewKeys,
  toReviewAuthor,
  validateReviewContent,
} from './reviews.ts'

test('normalizes followed episode RPC rows into the shared rating contract', () => {
  const result = mapFollowedEpisodeRatings(
    {
      '1:2': [
        {
          userId: 'user-1',
          username: null,
          displayName: 'Viewer',
          avatarUrl: null,
          rating: '4.5',
          watchedAt: null,
        },
      ],
    },
    { '1:2': 1 }
  )

  assert.deepEqual(result.episodes['1:2'][0], {
    user: { id: 'user-1', username: null, displayName: 'Viewer', avatarUrl: null },
    rating: 4.5,
    watchedAt: null,
  })
  assert.equal(result.totals['1:2'], 1)
})

test('versions followed episode rating cache entries with the normalized contract', () => {
  assert.deepEqual(ratingKeys.followedEpisodes('series-1', 1), [
    'followed-episode-ratings',
    2,
    'series-1',
    1,
  ])
})

test('drops malformed, orphan-shaped, duplicate, and legacy nested rows', () => {
  const reasons = []
  const result = mapFollowedEpisodeRatings(
    {
      '1:2': [
        { user_id: 'user-1', rating: 4, watched_at: '2026-08-01T00:00:00Z' },
        { userId: null, rating: 4 },
        { userId: 'user-2', rating: 'not-a-rating' },
        { userId: 'user-1', rating: 3 },
        { user: { id: 'user-3', username: 'legacy' }, rating: 5 },
        null,
      ],
    },
    { '1:2': 5 },
    (reason) => reasons.push(reason)
  )

  assert.deepEqual(
    result.episodes['1:2'].map((item) => item.user.id),
    ['user-1', 'user-3']
  )
  assert.equal(result.totals['1:2'], 2)
  assert.deepEqual(reasons, ['invalid-user-id', 'invalid-rating', 'duplicate', 'invalid-user-id'])
})

test('maps review authors from the Kino profile identity', () => {
  assert.deepEqual(
    toReviewAuthor({
      id: 'user-1',
      username: 'dex',
      display_name: 'Dex Kino',
      avatar_url: 'https://kino.test/dex.png',
    }),
    {
      id: 'user-1',
      username: 'dex',
      displayName: 'Dex Kino',
      avatarUrl: 'https://kino.test/dex.png',
    }
  )
})

test('uses a trimmed Kino display name then the username for review labels', () => {
  assert.equal(getReviewAuthorLabel({ displayName: '  Dex Kino  ', username: 'dex' }), 'Dex Kino')
  assert.equal(getReviewAuthorLabel({ displayName: '   ', username: 'dex' }), 'dex')
  assert.equal(getReviewAuthorLabel({ displayName: null, username: null }), null)
})

test('validates the shared half-star domain', () => {
  assert.equal(isValidHalfStepRating(null), true)
  assert.equal(isValidHalfStepRating(0.5), true)
  assert.equal(isValidHalfStepRating(4.5), true)
  assert.equal(isValidHalfStepRating(0), false)
  assert.equal(isValidHalfStepRating(0.3), false)
  assert.equal(isValidHalfStepRating(5.5), false)
})

test('trims and validates plain review content', () => {
  assert.equal(validateReviewContent('  thoughtful  '), 'thoughtful')
  assert.throws(() => validateReviewContent(' \n '))
  assert.throws(() => validateReviewContent('x'.repeat(2001)))
})

test('builds stable keys and keyset cursors from the extra row', () => {
  assert.deepEqual(reviewKeys.title('title-1'), ['title-reviews', 'title-1'])
  const row = {
    id: 'review-1',
    user_id: 'user-1',
    title_id: 'title-1',
    media_type: 'movie',
    content: 'Review',
    rating: '4.5',
    created_at: '2026-07-27T10:00:00Z',
    updated_at: '2026-07-27T10:00:00Z',
    like_count: '12',
    liked_by_viewer: true,
    tier: 1,
    total_count: '2',
  }
  const page = mapTitleReviewsPage(
    [row, { ...row, id: 'review-2', created_at: '2026-07-26T10:00:00Z' }],
    1
  )
  assert.equal(page.items[0].rating, 4.5)
  assert.equal(page.items[0].likeCount, 12)
  assert.equal(page.totalCount, 2)
  assert.deepEqual(page.nextCursor, {
    tier: 1,
    like_count: 12,
    created_at: '2026-07-27T10:00:00Z',
    id: 'review-1',
  })
})

test('maps grouped profile reviews with title context and a creation cursor', () => {
  const row = {
    id: 'review-1',
    user_id: 'user-1',
    title_id: 'title-1',
    media_type: 'movie',
    content: 'Review',
    rating: '4.5',
    created_at: '2026-07-27T10:00:00Z',
    updated_at: '2026-07-27T11:00:00Z',
    like_count: '12',
    liked_by_viewer: true,
    author_username: 'dex',
    author_display_name: 'Dex Kino',
    author_avatar_url: '/dex.png',
    is_viewer_review: true,
    total_count: '3',
    title_tmdb_id: 238,
    title_name: 'The Godfather',
    title_year: 1972,
    title_poster_url: '/poster.jpg',
  }

  const page = mapProfileReviewsPage(
    [row, { ...row, id: 'review-2', created_at: '2026-07-26T10:00:00Z' }],
    1
  )

  assert.deepEqual(page.items[0].title, {
    id: 'title-1',
    tmdbId: 238,
    mediaType: 'movie',
    name: 'The Godfather',
    slug: 'the-godfather',
    year: 1972,
    posterUrl: '/poster.jpg',
  })
  assert.deepEqual(page.nextCursor, {
    created_at: '2026-07-27T10:00:00Z',
    id: 'review-1',
  })
  assert.equal(page.totalCount, 3)
})
