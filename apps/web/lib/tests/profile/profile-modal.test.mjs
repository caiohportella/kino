import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('ProfileModal is a standalone reusable profile component', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-modal.tsx', import.meta.url),
    'utf8'
  )

  const profileView = await readFile(
    new URL('../../../components/profile/profile-view.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileModal/)

  assert.match(source, /DisplayTitle/)
  assert.match(source, /DialogContent/)

  assert.doesNotMatch(profileView, /function ProfileModal/)
})
