import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile social behavior lives in useProfileSocial', async () => {
  const source = await readFile(
    new URL('../../../hooks/profile/use-profile-social.ts', import.meta.url),
    'utf8'
  )
  const dialogSource = await readFile(
    new URL('../../../components/profile/profile-social-list-dialog.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function useProfileSocial/)

  assert.match(source, /getFollowers/)
  assert.match(source, /getFollowing/)
  assert.match(source, /followUser/)
  assert.match(source, /unfollowUser/)

  assert.doesNotMatch(source, /profile-user-search/)

  assert.doesNotMatch(source, /searchUsers/)

  assert.match(source, /onOpenChangeAction:/)
  assert.match(dialogSource, /onOpenChangeAction/)
  assert.match(dialogSource, /<Dialog onOpenChange=\{onOpenChangeAction\} open=\{open\}>/)
  assert.doesNotMatch(dialogSource, /onOpenChange,/)
})
