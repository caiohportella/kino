import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profile dashboard separates identity hero from profile statistics', async () => {
  const source = await readFile(
    new URL('../../../components/profile/profile-dashboard-hero.tsx', import.meta.url),
    'utf8'
  )
  const statsSource = await readFile(
    new URL('../../../components/profile/profile-hero-stats.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /export function ProfileDashboardHero/)

  assert.match(source, /ProfileHeroIdentity/)
  assert.match(source, /ProfileHeroStats/)
  assert.doesNotMatch(source, /ProfileRatingControls/)
  assert.doesNotMatch(source, /profile-rating-dialogs/)
  assert.doesNotMatch(source, /openMovieRating|openSeriesRating/)
  assert.doesNotMatch(source, /onMovieRatingClick|onSeriesRatingClick/)
  assert.match(source, /ProfileHeroStats/)
  assert.match(statsSource, /grid-cols-2[\s\S]*sm:grid-cols-3[\s\S]*lg:grid-cols-6/)
  assert.doesNotMatch(source, /ProfileRecentActivityCard|recentActivity/)

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

  assert.doesNotMatch(source, /useQuery/)
  assert.doesNotMatch(source, /useMutation/)
  assert.doesNotMatch(source, /\bdb\./)
})
