import assert from 'node:assert/strict'
import test from 'node:test'
import {
  insertViewerReview,
  removeReview,
  replaceReview,
  updateReviewLike,
} from './review-cache.ts'

const review = {
  id: 'review-1',
  userId: 'author-1',
  titleId: 'title-1',
  mediaType: 'movie',
  content: 'Original',
  rating: 4.5,
  likeCount: 1,
  likedByViewer: false,
  createdAt: '2026-07-27T10:00:00Z',
  updatedAt: '2026-07-27T10:00:00Z',
  author: { id: 'author-1', username: 'dex', displayName: null, avatarUrl: null },
  isViewerReview: false,
  tier: 2,
}
const page = { items: [review], nextCursor: null, totalCount: 1 }

test('inserts the viewer review first and adjusts totals', () => {
  const viewerReview = {
    ...review,
    id: 'review-viewer',
    userId: 'viewer',
    isViewerReview: true,
    tier: 0,
  }
  const updated = insertViewerReview(page, viewerReview)
  assert.equal(updated.items[0].id, 'review-viewer')
  assert.equal(updated.totalCount, 2)
})

test('replaces and removes reviews immutably', () => {
  const replaced = replaceReview(page, { ...review, content: 'Edited' })
  assert.equal(replaced.items[0].content, 'Edited')
  assert.equal(page.items[0].content, 'Original')
  const removed = removeReview(replaced, review.id)
  assert.equal(removed.items.length, 0)
  assert.equal(removed.totalCount, 0)
})

test('likes and unlikes without count drift', () => {
  const liked = updateReviewLike(page, review.id, true)
  assert.equal(liked.items[0].likeCount, 2)
  assert.equal(liked.items[0].likedByViewer, true)
  assert.deepEqual(updateReviewLike(liked, review.id, true), liked)
  assert.deepEqual(updateReviewLike(liked, review.id, false), page)
})
