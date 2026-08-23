import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile hero stats use the shared HeroStat primitive', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-hero-stats.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileHeroStats/)

  assert.match(source, /HeroStat/)

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /\bdb\./)
})

test('HeroStat supports interactive stats', async () => {
  const source = await readFile(
    new URL('../../../components/profile/hero-stat.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /onClick/)
  assert.match(source, /string \| number/)
})
