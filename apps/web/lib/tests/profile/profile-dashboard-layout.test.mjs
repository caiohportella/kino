import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile hero keeps identity content separate from the stat row', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-dashboard-hero.tsx', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /<ProfileHeroIdentity[\s\S]*profile=\{profile\}/,
    'the hero should render profile identity inside the banner'
  )

  assert.match(
    source,
    /<ProfileHeroStats[\s\S]*\{\.\.\.stats\}/,
    'profile statistics should render as a separate row below the identity hero'
  )

  assert.match(
    source,
    /<section[\s\S]*ProfileHeroBackground[\s\S]*ProfileHeroIdentity[\s\S]*<\/section>[\s\S]*<ProfileHeroStats/,
    'identity should remain inside the banner while stats stay outside it'
  )
  assert.match(source, /ProfileHeroStats/)
  assert.doesNotMatch(source, /recentActivity|ProfileRecentActivityCard/)
})

test('profile statistics no longer live in a separate six-card row', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-view.tsx', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(source, /mb-8 grid grid-cols-2 gap-3 lg:grid-cols-6/)
})
