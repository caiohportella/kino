import type { EpisodeRating, SeasonMetadata, TMDbPersonCredit, UIDiaryEntry, WatchedSeries } from './types'
import { isFutureDateOnly, parseDateOnly } from './date'

export interface NextEpisodeCandidate {
  season: number
  episode: number
  air_date?: string
}

const SERIES_COMPLETED_STATUSES = new Set(['ended', 'canceled', 'cancelled', 'complete', 'completed', 'finished'])

export function clampRating(value: number) {
  return Math.min(5, Math.max(0, Number(value.toFixed(1))))
}

export function getDisplayTitle(item: { title?: string; name?: string }) {
  return item.title || item.name || 'Untitled'
}

export function getReleaseYear(item: { release_date?: string; first_air_date?: string }) {
  const date = item.release_date || item.first_air_date
  if (!date) return null
  const year = Number.parseInt(date.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

export function calculateSeriesProgress(series: Pick<WatchedSeries, 'total_episodes' | 'watched_episode_count'>) {
  if (!series.total_episodes || series.total_episodes <= 0) return 0
  return Math.min(100, Math.round((series.watched_episode_count / series.total_episodes) * 100))
}

export function getEpisodeKey(seasonNumber: number, episodeNumber: number) {
  return `${seasonNumber}-${episodeNumber}`
}

export function isCompletedSeriesStatus(status: string | null | undefined) {
  if (!status) return false
  return SERIES_COMPLETED_STATUSES.has(status.trim().toLowerCase())
}

export function isUpcomingEpisode(value: { air_date?: string | null } | null | undefined, now = new Date()) {
  return Boolean(value?.air_date) && isFutureDateOnly(value?.air_date, now)
}

export function findFirstUnwatchedEpisode(
  seasons: SeasonMetadata[] | null | undefined,
  watchedEpisodeKeys: ReadonlySet<string>
): NextEpisodeCandidate | null {
  if (!seasons || seasons.length === 0) return null

  const orderedSeasons = [...seasons]
    .filter((season) => season.season_number > 0 && season.episode_count > 0)
    .sort((left, right) => left.season_number - right.season_number)

  for (const season of orderedSeasons) {
    for (let episode = 1; episode <= season.episode_count; episode += 1) {
      if (!watchedEpisodeKeys.has(getEpisodeKey(season.season_number, episode))) {
        return {
          season: season.season_number,
          episode,
          air_date: season.air_date || undefined,
        }
      }
    }
  }

  return null
}

export function findFirstUpcomingEpisode(
  seasons: SeasonMetadata[] | null | undefined,
  now = new Date()
): NextEpisodeCandidate | null {
  if (!seasons || seasons.length === 0) return null

  const orderedSeasons = [...seasons]
    .filter((season) => season.season_number > 0 && season.episode_count > 0 && isFutureDateOnly(season.air_date, now))
    .sort((left, right) => {
      const leftDate = parseDateOnly(left.air_date)
      const rightDate = parseDateOnly(right.air_date)
      if (!leftDate && !rightDate) return left.season_number - right.season_number
      if (!leftDate) return 1
      if (!rightDate) return -1
      return leftDate.getTime() - rightDate.getTime()
    })

  const nextSeason = orderedSeasons[0]
  if (!nextSeason) return null

  return {
    season: nextSeason.season_number,
    episode: 1,
    air_date: nextSeason.air_date || undefined,
  }
}

export function calculateSeasonRatingSummary(ratings: Array<Pick<EpisodeRating, 'rating'>>) {
  const ratedValues = ratings
    .map((rating) => rating.rating)
    .filter((rating): rating is number => typeof rating === 'number' && Number.isFinite(rating) && rating > 0)

  if (ratedValues.length === 0) {
    return {
      averageRating: null,
      ratedEpisodeCount: 0,
    }
  }

  const average = ratedValues.reduce((total, rating) => total + rating, 0) / ratedValues.length
  return {
    averageRating: clampRating(average),
    ratedEpisodeCount: ratedValues.length,
  }
}

export function getKnownForCredits(
  credits:
    | {
        cast?: TMDbPersonCredit[]
        crew?: TMDbPersonCredit[]
      }
    | null
    | undefined,
  limit = 24
) {
  const uniqueCredits = new Map<string, TMDbPersonCredit>()

  for (const credit of [...(credits?.cast ?? []), ...(credits?.crew ?? [])]) {
    if (credit.media_type !== 'movie' && credit.media_type !== 'tv') continue
    const key = `${credit.media_type}-${credit.id}`
    if (!uniqueCredits.has(key)) uniqueCredits.set(key, credit)
  }

  return Array.from(uniqueCredits.values())
    .sort((left, right) => right.vote_count - left.vote_count)
    .slice(0, limit)
}

export function getSeasonProgressSummary(
  series: Pick<
    WatchedSeries,
    | 'watched_episode_count'
    | 'total_episodes'
    | 'last_episode'
    | 'next_episode'
    | 'is_series_completed'
    | 'seasons_metadata'
  >
) {
  const nextEpisode = series.next_episode
  const currentSeasonNumber = nextEpisode?.season ?? series.last_episode?.season ?? null
  const currentSeason = series.seasons_metadata?.find((season) => season.season_number === currentSeasonNumber)
  const watchedBeforeCurrentSeason =
    series.seasons_metadata
      ?.filter((season) => currentSeasonNumber !== null && season.season_number < currentSeasonNumber)
      .reduce((total, season) => total + Math.max(0, season.episode_count), 0) ?? 0
  const watchedInSeason =
    currentSeasonNumber !== null
      ? Math.max(0, series.watched_episode_count - watchedBeforeCurrentSeason)
      : series.watched_episode_count

  if (series.is_series_completed) {
    return {
      nextLabel: 'Complete',
      seasonLabel: series.total_episodes
        ? `${series.total_episodes} of ${series.total_episodes} episodes watched`
        : `${series.watched_episode_count} episodes watched`,
    }
  }

  if (!nextEpisode) {
    return {
      nextLabel: 'Next episode unavailable',
      seasonLabel: series.total_episodes
        ? `${series.watched_episode_count} of ${series.total_episodes} episodes watched`
        : `${series.watched_episode_count} episodes watched`,
    }
  }

  return {
    nextLabel: `Next: S${nextEpisode.season}E${nextEpisode.episode}`,
    seasonLabel: currentSeason
      ? `Season ${currentSeason.season_number} - ${Math.min(watchedInSeason, currentSeason.episode_count)} of ${currentSeason.episode_count} episodes watched`
      : series.total_episodes
        ? `${series.watched_episode_count} of ${series.total_episodes} episodes watched`
        : `${series.watched_episode_count} episodes watched`,
  }
}

export function groupDiaryByMonth(entries: UIDiaryEntry[], locale = 'en-US') {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  })
  const groups = new Map<string, UIDiaryEntry[]>()

  for (const entry of entries) {
    const key = formatter.format(new Date(entry.watchedAt)).toUpperCase()
    groups.set(key, [...(groups.get(key) || []), entry])
  }

  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }))
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

export function chooseBestSearchCandidate<
  T extends {
    id: number
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    release_date?: string
    first_air_date?: string
  }
>(
  title: string,
  year: number | null,
  candidates: T[]
) {
  const target = normalizeSearchText(title)
  const scored = candidates
    .map((candidate) => {
      const candidateTitle = normalizeSearchText(candidate.title || candidate.name || '')
      const candidateOriginal = normalizeSearchText(candidate.original_title || candidate.original_name || '')
      const candidateYear = getReleaseYear(candidate)
      let score = 0
      if (candidateTitle === target || candidateOriginal === target) {
        score += 10
      } else if (
        candidateTitle.includes(target) ||
        target.includes(candidateTitle) ||
        candidateOriginal.includes(target) ||
        target.includes(candidateOriginal)
      ) {
        score += 5
      }
      if (year && candidateYear === year) {
        score += 4
      }
      return { candidate, score }
    })
    .sort((left, right) => right.score - left.score)

  return scored[0]?.candidate ?? null
}
