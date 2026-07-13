import assert from 'node:assert/strict'
import test from 'node:test'
import { getEpisodeKey, resolveReleasedSeriesProgress } from './use-cases.ts'

const now = new Date(2026, 6, 12, 12)
const episode = (season, number, airDate) => ({
  season_number: season,
  episode_number: number,
  air_date: airDate,
})
const watched = (...keys) => new Set(keys)

test('announced seasons without released episodes do not create progress', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(1, 1, '2026-07-01'), episode(2, 1, null)],
    watched(getEpisodeKey(1, 1)),
    now
  )
  assert.equal(progress.isCaughtUp, true)
  assert.equal(progress.nextEpisode, null)
  assert.equal(progress.releasedEpisodeCount, 1)
})

test('future episodes remain unavailable', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(1, 1, '2026-07-01'), episode(1, 2, '2026-07-13')],
    watched(getEpisodeKey(1, 1)),
    now
  )
  assert.equal(progress.isCaughtUp, true)
  assert.equal(progress.nextEpisode, null)
})

test('episodes airing today are available', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(1, 1, '2026-07-01'), episode(1, 2, '2026-07-12')],
    watched(getEpisodeKey(1, 1)),
    now
  )
  assert.deepEqual(progress.nextEpisode, { season: 1, episode: 2, air_date: '2026-07-12' })
  assert.equal(progress.isCaughtUp, false)
})

test('the oldest released unwatched episode is selected', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(1, 1, '2026-06-01'), episode(1, 2, '2026-06-08'), episode(1, 3, '2026-06-15')],
    watched(getEpisodeKey(1, 1), getEpisodeKey(1, 3)),
    now
  )
  assert.equal(progress.nextEpisode?.episode, 2)
})

test('weekly seasons count only episodes released so far', () => {
  const progress = resolveReleasedSeriesProgress(
    [
      episode(1, 1, '2026-07-01'),
      episode(1, 2, '2026-07-08'),
      episode(1, 3, '2026-07-15'),
      episode(1, 4, '2026-07-22'),
    ],
    watched(getEpisodeKey(1, 1)),
    now
  )
  assert.equal(progress.releasedEpisodeCount, 2)
  assert.equal(progress.nextEpisode?.episode, 2)
})

test('fully watched ended series are caught up', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(1, 1, '2020-01-01'), episode(1, 2, '2020-01-08')],
    watched(getEpisodeKey(1, 1), getEpisodeKey(1, 2)),
    now
  )
  assert.equal(progress.isCaughtUp, true)
  assert.equal(progress.nextEpisode, null)
})

test('provider totals cannot add unreleased progress', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(1, 1, '2026-07-01'), episode(1, 2, '2027-01-01')],
    watched(getEpisodeKey(1, 1)),
    now
  )
  assert.equal(progress.releasedEpisodeCount, 1)
  assert.equal(progress.watchedReleasedEpisodeCount, 1)
})

test('missing and invalid air dates are excluded', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(1, 1, null), episode(1, 2, ''), episode(1, 3, '2026-02-31')],
    watched(getEpisodeKey(1, 1)),
    now
  )
  assert.equal(progress.releasedEpisodeCount, 0)
  assert.equal(progress.nextEpisode, null)
})

test('specials and placeholder episode numbers are excluded', () => {
  const progress = resolveReleasedSeriesProgress(
    [episode(0, 1, '2026-01-01'), episode(1, 0, '2026-01-01'), episode(1, 1, '2026-01-01')],
    watched(),
    now
  )
  assert.equal(progress.releasedEpisodeCount, 1)
  assert.equal(progress.nextEpisode?.episode, 1)
})

test('a newly released episode makes a caught-up series eligible again', () => {
  const episodes = [episode(1, 1, '2026-07-01'), episode(1, 2, '2026-07-13')]
  const keys = watched(getEpisodeKey(1, 1))
  const beforeAirDate = resolveReleasedSeriesProgress(episodes, keys, now)
  const afterAirDate = resolveReleasedSeriesProgress(episodes, keys, new Date(2026, 6, 13, 12))

  assert.equal(beforeAirDate.isCaughtUp, true)
  assert.equal(afterAirDate.isCaughtUp, false)
  assert.equal(afterAirDate.nextEpisode?.episode, 2)
})
