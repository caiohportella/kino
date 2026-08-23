import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const statsPageUrl = new URL('../../../components/profile/profile-stats-page.tsx', import.meta.url)

const profileDashboardHeroUrl = new URL(
  '../../../components/profile/profile-dashboard-hero.tsx',
  import.meta.url
)

test('lifetime stats renders separate top-rated movie and series rankings', async () => {
  const source = await readFile(statsPageUrl, 'utf8')

  assert.match(
    source,
    /useProfileLifetimeRecap/,
    'the lifetime page should load the canonical lifetime recap'
  )

  assert.match(
    source,
    /ProfileLifetimeTopRatedSection/,
    'the lifetime page should render the dedicated ranked-title section'
  )

  assert.match(source, /topRatedMovies/, 'the lifetime page should render the movie top 10')

  assert.match(source, /topRatedSeries/, 'the lifetime page should render the series top 10')
})

test('profile dashboard no longer owns top-rated rating dialogs', async () => {
  const source = await readFile(profileDashboardHeroUrl, 'utf8')

  assert.doesNotMatch(
    source,
    /ProfileRatingControls/,
    'top-rated rankings should no longer be opened from the profile dashboard'
  )

  assert.doesNotMatch(
    source,
    /openMovieRating|openSeriesRating/,
    'profile stats should no longer expose rating-dialog actions'
  )

  assert.doesNotMatch(
    source,
    /onMovieRatingClick|onSeriesRatingClick/,
    'profile stats should no longer be clickable dialog triggers'
  )
})
