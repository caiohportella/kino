import assert from 'node:assert/strict'
import test from 'node:test'
import { profileQueryKeys } from '@kino/core/cache'
import { profileStatsQueryOptions } from './profile-stats-query.ts'

test('builds the dedicated lifetime stats query key from the profile id and visibility scope', () => {
  const options = profileStatsQueryOptions({
    profileId: 'profile-a',
    service: {
      getProfileLifetimeStatsByProfileId: async () => ({
        episodesWatched: 0,
        moviesWatched: 0,
        ratingsMade: 0,
        timeWatchedMinutes: 0,
      }),
    },
    visibilityScope: {
      kind: 'authenticated',
      userId: 'viewer-a',
    },
  })

  assert.deepEqual(
    options.queryKey,
    profileQueryKeys.lifetimeStats({
      profileId: 'profile-a',
      visibilityScope: {
        kind: 'authenticated',
        userId: 'viewer-a',
      },
    })
  )
})
