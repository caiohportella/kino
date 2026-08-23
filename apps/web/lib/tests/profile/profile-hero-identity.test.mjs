import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile hero identity is a standalone presentation component', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-hero-identity.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileHeroIdentity/)

  assert.match(source, /ProfileShareButton/)
  assert.match(source, /Avatar/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /\bdb\./)
})
