import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('localized profile shelf states are shared components', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-shelf-state.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileShelfSkeleton/)

  assert.match(source, /export function ProfileShelfError/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /\bdb\./)
})
