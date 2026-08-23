import assert from 'node:assert/strict'
import test from 'node:test'

import { getDiscoverFeedQueries } from '../../discover/feed-queries.ts'

test('discover feed queries use explicit current release windows', () => {
  const queries = getDiscoverFeedQueries(new Date('2026-08-21T12:00:00.000Z'))

  assert.deepEqual(queries.newReleases.params, {
    sort_by: 'popularity.desc',
    'release_date.gte': '2026-07-07',
    'release_date.lte': '2026-08-21',
    with_release_type: '3|2|4',
    include_adult: 'false',
    include_video: 'false',
  })

  assert.deepEqual(queries.upcoming.params, {
    sort_by: 'popularity.desc',
    'release_date.gte': '2026-08-22',
    'release_date.lte': '2026-11-19',
    with_release_type: '3|2',
    include_adult: 'false',
    include_video: 'false',
  })
})

test('popular movies cannot include unreleased titles', () => {
  const queries = getDiscoverFeedQueries(new Date('2026-08-21T12:00:00.000Z'))

  assert.deepEqual(queries.popularMovies.params, {
    sort_by: 'popularity.desc',
    'release_date.lte': '2026-08-21',
    include_adult: 'false',
    include_video: 'false',
  })
})

test('discover feed queries expose their date window', () => {
  const queries = getDiscoverFeedQueries(new Date('2026-08-21T12:00:00.000Z'))

  assert.deepEqual(queries.window, {
    recentStart: '2026-07-07',
    today: '2026-08-21',
    tomorrow: '2026-08-22',
    upcomingEnd: '2026-11-19',
  })
})
