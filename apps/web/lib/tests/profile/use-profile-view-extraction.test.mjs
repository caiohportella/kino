import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('useProfileView owns profile data orchestration', async () => {
  const source = await readFile(
    new URL('../../../hooks/profile/use-profile-view.ts', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function useProfileView/)

  assert.match(source, /useProfileUsernameResolution/)

  assert.match(source, /useProfileIdentity/)

  assert.match(source, /useProfileSections/)

  assert.match(source, /useProfileMediaStats/)

  assert.doesNotMatch(source, /useProfileRatings/)

  assert.match(source, /useBridgeProfileReviewsCache/)

  assert.match(source, /subscribeToWatchlistChanges/)

  assert.match(source, /syncCurrentUserSearchProfile/)

  assert.match(source, /updateUserProfile/)

  assert.doesNotMatch(source, /searchUsers/)

  assert.doesNotMatch(source, /profile-user-search/)

  assert.doesNotMatch(source, /\.followUser\(/)

  assert.doesNotMatch(source, /\.unfollowUser\(/)
})
