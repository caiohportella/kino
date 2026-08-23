import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile hero uses fluid desktop sizing', async () => {
  const [heroSource, identitySource] = await Promise.all([
    readFile(
      new URL('../../../components/profile/profile-dashboard-hero.tsx', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../../../components/profile/profile-hero-identity.tsx', import.meta.url),
      'utf8'
    ),
  ])

  assert.match(heroSource, /min-h-\[clamp\(460px,48vh,580px\)\]/)

  assert.match(
    heroSource,
    /<ProfileHeroIdentity[\s\S]*profile=\{profile\}/,
    'the hero should render profile identity inside the banner'
  )

  assert.match(
    heroSource,
    /<ProfileHeroStats[\s\S]*\{\.\.\.stats\}/,
    'profile statistics should render as a separate row below the identity hero'
  )

  assert.match(
    heroSource,
    /<section[\s\S]*ProfileHeroBackground[\s\S]*ProfileHeroIdentity[\s\S]*<\/section>[\s\S]*<ProfileHeroStats/,
    'identity should remain inside the banner while stats stay outside it'
  )

  assert.match(identitySource, /sm:text-4xl/)
  assert.match(identitySource, /lg:text-3xl/)
})
