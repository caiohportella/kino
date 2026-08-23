import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

test('profile header no longer ships a dedicated recent activity card', () => {
  assert.equal(
    existsSync(
      new URL('../../../components/profile/profile-recent-activity-card.tsx', import.meta.url)
    ),
    false
  )
})
