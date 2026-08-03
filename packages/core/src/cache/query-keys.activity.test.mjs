import assert from 'node:assert/strict'
import test from 'node:test'
import { activityQueryKeys } from './query-keys.ts'

test('activity feed keys isolate the viewer scope, own-activity filter, locale, and page size', () => {
  const first = activityQueryKeys.feed({
    viewerId: ' viewer-a ',
    includeOwnActivity: true,
    locale: 'en',
    region: 'US',
    pageSize: 12,
  })

  const second = activityQueryKeys.feed({
    viewerId: 'viewer-a',
    includeOwnActivity: false,
    locale: 'en',
    region: 'US',
    pageSize: 12,
  })

  const third = activityQueryKeys.feed({
    viewerId: 'viewer-a',
    includeOwnActivity: true,
    locale: 'fr',
    region: 'FR',
    cursor: { createdAt: '2026-08-02T00:00:00.000Z', activityId: 'activity-2' },
    pageSize: 12,
  })

  assert.deepEqual(first, [
    'v1',
    'activity',
    'feed',
    'viewer-a',
    'self-enabled',
    'en',
    'US',
    ['head'],
    12,
    'v1',
  ])
  assert.deepEqual(second, [
    'v1',
    'activity',
    'feed',
    'viewer-a',
    'self-disabled',
    'en',
    'US',
    ['head'],
    12,
    'v1',
  ])
  assert.deepEqual(third, [
    'v1',
    'activity',
    'feed',
    'viewer-a',
    'self-enabled',
    'fr',
    'FR',
    ['2026-08-02T00:00:00.000Z', 'activity-2'],
    12,
    'v1',
  ])

  assert.notDeepEqual(first, second)
  assert.notDeepEqual(first, third)
  assert.notDeepEqual(first.slice(0, 7), third.slice(0, 7))
})
