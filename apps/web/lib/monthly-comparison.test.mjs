import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPreviousMonthComparisonRows,
  getComparisonTone,
} from './monthly-comparison.ts'

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
    locale: 'en-US',
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
