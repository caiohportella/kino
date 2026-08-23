import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL('../../../components/profile/profile-stats-page.tsx', import.meta.url),
  'utf8'
)

test('milestones render a primary value with secondary context', () => {
  assert.equal(source.includes('function MilestoneRow'), true)

  assert.equal(source.includes('detail={firstDiaryEntry?.detail}'), true)

  assert.equal(source.includes('detail={mostRewatched?.detail}'), true)

  assert.equal(source.includes('detail={longestMovie?.detail}'), true)

  assert.equal(source.includes('detail={longestFinishedSeries?.detail}'), true)
})

test('milestone analytics keep rewatch data structured', () => {
  assert.equal(source.includes('detail: `${current.count} rewatch'), false)

  assert.equal(source.includes('lastWatchedAt:'), true)
  assert.equal(source.includes('count: rewatched.count'), true)
})

test('movie and completed-series milestones reuse existing watch dates', () => {
  assert.equal(source.includes('detail: formatWatchedAt(longestMovie.watchedAt, locale)'), true)

  assert.equal(
    source.includes('detail: formatWatchedAt(finishedSeries.latest_watched_at, locale)'),
    true
  )
})
