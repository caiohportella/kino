import assert from 'node:assert/strict'
import test from 'node:test'

import { getDiscoverDateWindow, isDateOnlyWithin } from '../../discover/feed-dates.ts'

test('discover date window defines recent and upcoming release ranges', () => {
  const now = new Date('2026-08-21T12:00:00.000Z')

  assert.deepEqual(getDiscoverDateWindow(now), {
    recentStart: '2026-07-07',
    today: '2026-08-21',
    tomorrow: '2026-08-22',
    upcomingEnd: '2026-11-19',
  })
})

test('release date eligibility is inclusive at both boundaries', () => {
  assert.equal(isDateOnlyWithin('2026-08-21', '2026-07-07', '2026-08-21'), true)

  assert.equal(isDateOnlyWithin('2026-07-06', '2026-07-07', '2026-08-21'), false)

  assert.equal(isDateOnlyWithin('2026-08-22', '2026-07-07', '2026-08-21'), false)

  assert.equal(isDateOnlyWithin(null, '2026-07-07', '2026-08-21'), false)
})
