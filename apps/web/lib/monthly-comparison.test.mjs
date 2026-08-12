import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  buildPreviousMonthComparisonRows,
  getComparisonTone,
} from './monthly-comparison.ts'

const previousMonthCardSource = await readFile(
  new URL('../components/profile/previous-month-card.tsx', import.meta.url),
  'utf8',
)

test('selects a semantic tone for positive, negative, and zero deltas', () => {
  assert.equal(getComparisonTone(1), 'positive')
  assert.equal(getComparisonTone(-1), 'negative')
  assert.equal(getComparisonTone(0), 'neutral')
})

test('builds all four previous-month comparison rows with localized watch-time formatting', () => {
  const rows = buildPreviousMonthComparisonRows({
    comparison: {
      timeWatchedMinutesDelta: -(8 * 60 + 24),
      moviesDelta: 3,
      episodesDelta: 0,
      ratingsDelta: -2,
    },
    labels: {
      timeWatched: 'Time watched',
      moviesWatched: 'Movies watched',
      episodesWatched: 'Episodes watched',
      ratingsMade: 'Ratings made',
    },
    formatTimeDelta: (minutes) => {
      assert.equal(minutes, -(8 * 60 + 24))
      return '−8h 24m'
    },
  })

  assert.deepEqual(rows, [
    {
      id: 'time',
      label: 'Time watched',
      value: '−8h 24m',
      delta: -(8 * 60 + 24),
    },
    {
      id: 'movies',
      label: 'Movies watched',
      value: '+3',
      delta: 3,
    },
    {
      id: 'episodes',
      label: 'Episodes watched',
      value: '0',
      delta: 0,
    },
    {
      id: 'ratings',
      label: 'Ratings made',
      value: '-2',
      delta: -2,
    },
  ])

  assert.deepEqual(
    rows.map((row) => getComparisonTone(row.delta)),
    ['negative', 'positive', 'neutral', 'negative'],
  )
})

test('previous-month comparison applies semantic tone to the visible delta value', () => {
  assert.equal(previousMonthCardSource.includes('valueClassName'), true)
  assert.match(previousMonthCardSource, /valueClassName[\s\S]*text-kino-accent/)
  assert.match(previousMonthCardSource, /<span className=\{valueClassName\}>\{value\}<\/span>/)
})
