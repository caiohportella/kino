import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile section state helpers live outside profile-view', async () => {
  const component = await readFile(
    new URL('../../../components/profile/profile-section-state.tsx', import.meta.url),
    'utf8'
  )

  const profileView = await readFile(
    new URL('../../../components/profile/profile-view.tsx', import.meta.url),
    'utf8'
  )

  assert.match(component, /export function ProfileSectionState/)

  assert.match(component, /export function ProfileRelationshipAction/)

  assert.match(component, /export function ProfileRatingStatState/)

  assert.doesNotMatch(profileView, /function ProfileSectionState/)
})
