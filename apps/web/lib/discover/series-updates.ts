import type { TMDbTitle, WatchedSeries } from '@kino/core'
import { findNextKnownSeason } from '@kino/core'

const DAY_MS = 24 * 60 * 60 * 1000

export const DISCOVER_NEW_EPISODE_DAYS = 14
export const DISCOVER_UPCOMING_SEASON_DAYS = 90
export const DISCOVER_SERIES_UPDATE_CANDIDATE_LIMIT = 12

export type DiscoverSeriesUpdate = {
  tmdbId: number
  kind: 'episode' | 'season'
  season: number
  episode: number | null
  airDate: string
}

export type DiscoverSeriesUpdateItem = {
  title: TMDbTitle
  update: DiscoverSeriesUpdate
}

export function selectDiscoverSeriesUpdateCandidates<
  T extends {
    tmdb_id: number
    latest_watched_at: string
  },
>(series: T[], limit = DISCOVER_SERIES_UPDATE_CANDIDATE_LIMIT): T[] {
  const unique = new Map<number, T>()

  for (const item of series) {
    const existing = unique.get(item.tmdb_id)

    if (!existing || Date.parse(item.latest_watched_at) > Date.parse(existing.latest_watched_at)) {
      unique.set(item.tmdb_id, item)
    }
  }

  return [...unique.values()]
    .sort((left, right) => Date.parse(right.latest_watched_at) - Date.parse(left.latest_watched_at))
    .slice(0, limit)
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function parseDateOnly(value: string | undefined) {
  if (!value) return null

  const parsed = Date.parse(`${value}T00:00:00.000Z`)

  return Number.isFinite(parsed) ? parsed : null
}

function isRecentDate(value: string, now: Date, days: number) {
  const date = parseDateOnly(value)

  if (date === null) return false

  const today = startOfUtcDay(now)
  const earliest = today - days * DAY_MS

  return date >= earliest && date <= today
}

function isUpcomingDate(value: string, now: Date, days: number) {
  const date = parseDateOnly(value)

  if (date === null) return false

  const today = startOfUtcDay(now)
  const latest = today + days * DAY_MS

  return date > today && date <= latest
}

export function getDiscoverSeriesUpdates(
  series: Pick<
    WatchedSeries,
    'tmdb_id' | 'next_episode' | 'is_caught_up' | 'watched_episode_keys' | 'seasons_metadata'
  >[],
  now = new Date()
): DiscoverSeriesUpdate[] {
  const updates: DiscoverSeriesUpdate[] = []

  for (const item of series) {
    const nextEpisode = item.next_episode

    if (
      nextEpisode?.air_date &&
      isRecentDate(nextEpisode.air_date, now, DISCOVER_NEW_EPISODE_DAYS)
    ) {
      updates.push({
        tmdbId: item.tmdb_id,
        kind: 'episode',
        season: nextEpisode.season,
        episode: nextEpisode.episode,
        airDate: nextEpisode.air_date,
      })

      continue
    }

    const nextSeason = findNextKnownSeason(item)

    if (
      nextSeason?.air_date &&
      isUpcomingDate(nextSeason.air_date, now, DISCOVER_UPCOMING_SEASON_DAYS)
    ) {
      updates.push({
        tmdbId: item.tmdb_id,
        kind: 'season',
        season: nextSeason.season,
        episode: null,
        airDate: nextSeason.air_date,
      })
    }
  }

  return updates.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'episode' ? -1 : 1
    }

    if (left.kind === 'episode') {
      return right.airDate.localeCompare(left.airDate)
    }

    return left.airDate.localeCompare(right.airDate)
  })
}
