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

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

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
  locale,
}: {
  comparison: ProfileMonthlyRecap['previousMonthComparison']
  labels: ComparisonLabels
  locale: string
}): PreviousMonthComparisonRow[] {
  return [
    {
      id: 'time',
      label: labels.timeWatched,
      value: formatWatchTimeDelta(comparison.timeWatchedMinutesDelta, locale),
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

function formatWatchTimeDelta(minutes: number, locale: string) {
  const sign = minutes > 0 ? '+' : minutes < 0 ? '\u2212' : ''

  return `${sign}${formatWatchTimeCompact(Math.abs(minutes), locale)}`
}

function formatWatchTimeCompact(minutes: number, locale: string) {
  const parts = splitWatchTime(minutes)
  const formatter = new Intl.NumberFormat(locale)

  if (parts.days > 0) {
    return parts.hours > 0
      ? `${formatter.format(parts.days)}d ${formatter.format(parts.hours)}h`
      : `${formatter.format(parts.days)}d`
  }

  if (parts.hours > 0) {
    return parts.minutes > 0
      ? `${formatter.format(parts.hours)}h ${formatter.format(parts.minutes)}m`
      : `${formatter.format(parts.hours)}h`
  }

  return `${formatter.format(parts.minutes)}m`
}

function splitWatchTime(minutes: number) {
  const totalMinutes = Math.max(0, Math.floor(minutes))
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY)
  const remainderAfterDays = totalMinutes % MINUTES_PER_DAY
  const hours = Math.floor(remainderAfterDays / MINUTES_PER_HOUR)
  const remainingMinutes = remainderAfterDays % MINUTES_PER_HOUR

  return { days, hours, minutes: remainingMinutes }
}


