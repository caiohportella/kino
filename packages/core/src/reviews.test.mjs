import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isValidHalfStepRating,
  mapTitleReviewsPage,
  reviewKeys,
  validateReviewContent,
} from './reviews.ts'

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
