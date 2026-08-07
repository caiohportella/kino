import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

test('activity cards do not render the removed timestamp metadata row', async () => {
  const source = await readFile(
    new URL('../components/activity-feed/ActivityCard.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(source, /date:\s*\(/)
  assert.doesNotMatch(source, /CalendarDays|Clock3|formatLocalizedRelativeTime/)
})

test('activity feed merges matching rating and review events', async () => {
  const source = await readFile(new URL('./activity-feed.ts', import.meta.url), 'utf8')
  assert.match(source, /ratingByActivityKey/)
  assert.match(source, /activityKind: rating \? 'rated_and_reviewed'/)
  assert.match(
    source,
    /if \(reviewByActivityKey\.has\(createActivityKey\(item\.actor\.id, item\.title\.id\)\)\) return null/
  )
})
