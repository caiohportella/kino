import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLocalizedDate, formatLocalizedRelativeTime } from './date.ts'

test('date-only activity values stay on the authored calendar day', () => {
  assert.equal(
    formatLocalizedDate('2026-07-28', 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }),
    'Jul 28, 2026'
  )
})

test('relative activity time uses localized singular and plural translation keys', () => {
  const now = new Date('2026-08-07T12:00:00.000Z')
  const translate = (key, options = {}) => `${key}:${options.count ?? ''}`

  assert.equal(
    formatLocalizedRelativeTime('2026-08-06T12:00:00.000Z', translate, now),
    'activity.dayAgo:1'
  )
  assert.equal(
    formatLocalizedRelativeTime('2026-03-07T12:00:00.000Z', translate, now),
    'activity.monthsAgo:5'
  )
})
