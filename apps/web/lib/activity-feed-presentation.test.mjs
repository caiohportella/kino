import assert from 'node:assert/strict'
import test from 'node:test'
import { getActivityKind } from './activity-presentation.ts'

test('diary activity distinguishes watched and rated from watched without rating', () => {
  assert.equal(getActivityKind('watch', 4.5), 'watched_and_rated')
  assert.equal(getActivityKind('watch', null), 'watched')
})

test('following rating-only and review-only activity keep distinct kinds', () => {
  assert.equal(getActivityKind('review', null), 'reviewed')
  assert.equal(getActivityKind('rating', 4), 'rated')
})
