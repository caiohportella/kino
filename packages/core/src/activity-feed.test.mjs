import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createActivityCursor,
  deduplicateActivities,
  enrichActivityPage,
  getActivityKey,
  getDisplayName,
  normalizeActivityFeedItems,
  toActivityActor,
} from './activity.ts'

const titleA = {
  id: 1,
  mediaType: 'movie',
  name: 'Movie A',
  slug: 'movie-a',
  year: 2025,
  posterUrl: null,
}
const titleB = {
  id: 2,
  mediaType: 'tv',
  name: 'Series B',
  slug: 'series-b',
  year: 2024,
  posterUrl: null,
}

test('activity feed normalization orders mixed events by newest timestamp and stable cursor', () => {
  const items = [
    {
      id: 'rating-1',
      actorId: 'user-1',
      createdAt: '2026-07-01T12:00:00.000Z',
      visibility: 'public',
      type: 'rating',
      title: titleA,
      rating: 4.5,
    },
    {
      id: 'watch-1',
      actorId: 'user-2',
      createdAt: '2026-07-02T18:00:00.000Z',
      visibility: 'public',
      type: 'watch',
      title: titleB,
      watchedAt: '2026-07-02T18:00:00.000Z',
      isRewatch: false,
      rating: null,
    },
    {
      id: 'review-1',
      actorId: 'user-3',
      createdAt: '2026-07-02T18:00:00.000Z',
      visibility: 'public',
      type: 'review',
      title: titleA,
      rating: 5,
      review: {
        id: 'review-1',
        content: 'Love it',
        likeCount: 0,
        likedByViewer: false,
      },
    },
  ]

  const normalized = normalizeActivityFeedItems(items)
  const cursor = createActivityCursor(normalized[0])

  assert.equal(normalized[0].id, 'watch-1')
  assert.equal(normalized[1].id, 'review-1')
  assert.equal(normalized[2].id, 'rating-1')
  assert.deepEqual(cursor, {
    createdAt: '2026-07-02T18:00:00.000Z',
    activityId: 'watch-1',
  })
})

test('toActivityActor maps a UserProfile to the ActivityActor shape', () => {
  assert.deepEqual(
    toActivityActor({
      id: 'user-1',
      username: 'alice',
      display_name: 'Alice Example',
      avatar_url: 'https://example.com/a.png',
    }),
    {
      id: 'user-1',
      username: 'alice',
      displayName: 'Alice Example',
      avatarUrl: 'https://example.com/a.png',
    }
  )
})

test('getDisplayName prefers display name, then username, then fallback', () => {
  assert.equal(
    getDisplayName({ id: '1', username: 'alice', displayName: 'Alice', avatarUrl: null }),
    'Alice'
  )
  assert.equal(
    getDisplayName({ id: '1', username: 'bob', displayName: null, avatarUrl: null }),
    'bob'
  )
  assert.equal(
    getDisplayName({ id: '1', username: null, displayName: null, avatarUrl: null }),
    'Kino user'
  )
})

test('getActivityKey produces stable unique keys that distinguish activity types', () => {
  const reviewActivity = {
    id: 'abc-123',
    actorId: 'user-1',
    createdAt: '2026-08-01T10:00:00.000Z',
    visibility: 'public',
    type: 'review',
    title: titleA,
    rating: 4.5,
    review: { id: 'rev-1', content: 'Great', likeCount: 1, likedByViewer: false },
  }
  const ratingActivity = {
    id: 'abc-123',
    actorId: 'user-1',
    createdAt: '2026-08-01T10:00:00.000Z',
    visibility: 'public',
    type: 'rating',
    title: titleA,
    rating: 4,
  }

  // Same UUID but different types must produce different keys
  assert.notEqual(getActivityKey(reviewActivity), getActivityKey(ratingActivity))
})

test('enrichActivityPage attaches actor profiles and skips missing actors', () => {
  const activities = [
    {
      id: 'act-1',
      actorId: 'user-1',
      createdAt: '2026-08-01T10:00:00.000Z',
      visibility: 'public',
      type: 'review',
      title: titleA,
      rating: null,
      review: { id: 'rev-1', content: 'Nice', likeCount: 3, likedByViewer: true },
    },
    {
      id: 'act-2',
      actorId: 'user-missing',
      createdAt: '2026-08-01T09:00:00.000Z',
      visibility: 'public',
      type: 'watch',
      title: titleB,
      watchedAt: '2026-08-01T09:00:00.000Z',
      isRewatch: false,
      rating: null,
    },
  ]

  const profiles = {
    'user-1': {
      id: 'user-1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: 'https://example.com/a.png',
    },
  }

  const enriched = enrichActivityPage(activities, profiles)
  assert.equal(enriched.length, 1)
  assert.equal(enriched[0].actor.id, 'user-1')
  assert.equal(enriched[0].actor.displayName, 'Alice')
})

test('deduplicateActivities removes duplicates by activity key', () => {
  const base = {
    actorId: 'user-1',
    createdAt: '2026-08-01T10:00:00.000Z',
    visibility: 'public',
    title: titleA,
    rating: 5,
  }

  const first = { id: 'dup-1', type: 'rating', ...base }
  const second = { id: 'dup-1', type: 'rating', ...base }

  const enriched = enrichActivityPage([first, second], {
    'user-1': {
      id: 'user-1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: null,
    },
  })

  const deduped = deduplicateActivities(enriched)
  assert.equal(deduped.length, 1)
})
