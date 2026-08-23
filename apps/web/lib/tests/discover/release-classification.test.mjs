import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hasUpcomingRerelease,
  isFirstRunUpcomingRelease,
} from '../../discover/release-classification.ts'

test('first regional theatrical release inside the upcoming window is upcoming', () => {
  const releases = [
    {
      release_date: '2026-08-29T00:00:00.000Z',
      type: 3,
    },
  ]

  assert.equal(isFirstRunUpcomingRelease(releases, '2026-08-22', '2026-11-19'), true)
})

test('later screening of an already released movie is not first-run upcoming', () => {
  const releases = [
    {
      release_date: '2026-04-24T00:00:00.000Z',
      type: 3,
    },
    {
      release_date: '2026-08-29T00:00:00.000Z',
      type: 3,
    },
  ]

  assert.equal(isFirstRunUpcomingRelease(releases, '2026-08-22', '2026-11-19'), false)
})

test('later theatrical screening is classified as a rerelease', () => {
  const releases = [
    {
      release_date: '2006-06-09T00:00:00.000Z',
      type: 3,
    },
    {
      release_date: '2026-09-01T00:00:00.000Z',
      type: 3,
    },
  ]

  assert.equal(hasUpcomingRerelease(releases, '2026-08-21', '2026-11-19'), true)
})
