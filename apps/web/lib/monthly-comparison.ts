import type { ProfileMonthlyRecap } from '@kino/core'

export type ComparisonTone = 'positive' | 'negative' | 'neutral'

export type PreviousMonthComparisonRow = {
  id: string
  label: string
  value: string
  delta: number
}

type ComparisonLabels = {
  timeWatched: string
  moviesWatched: string
  episodesWatched: string
  ratingsMade: string
}

export function getComparisonTone(delta: number): ComparisonTone {
  if (delta > 0) {
    return 'positive'
  }

  if (delta < 0) {
    return 'negative'
  }

  return 'neutral'
}

export function buildPreviousMonthComparisonRows({
  comparison,
  labels,
  formatTimeDelta,
}: {
  comparison: ProfileMonthlyRecap['previousMonthComparison']
  labels: ComparisonLabels
  formatTimeDelta: (minutes: number) => string
}): PreviousMonthComparisonRow[] {
  return [
    {
      id: 'time',
      label: labels.timeWatched,
      value: formatTimeDelta(comparison.timeWatchedMinutesDelta),
      delta: comparison.timeWatchedMinutesDelta,
    },
    {
      id: 'movies',
      label: labels.moviesWatched,
      value: formatDelta(comparison.moviesDelta),
      delta: comparison.moviesDelta,
    },
    {
      id: 'episodes',
      label: labels.episodesWatched,
      value: formatDelta(comparison.episodesDelta),
      delta: comparison.episodesDelta,
    },
    {
      id: 'ratings',
      label: labels.ratingsMade,
      value: formatDelta(comparison.ratingsDelta),
      delta: comparison.ratingsDelta,
    },
  ]
}

function formatDelta(value: number) {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}`
}


