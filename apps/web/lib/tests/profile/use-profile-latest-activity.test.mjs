import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

test('profile header no longer ships a latest-activity hook', () => {
  assert.equal(
    existsSync(new URL('../../../hooks/profile/use-profile-latest-activity.ts', import.meta.url)),
    false
  )
})
