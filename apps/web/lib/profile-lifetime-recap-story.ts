import { localeRegion, type ProfileLifetimeRecap } from '@kino/core'
import {
  LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
  type LocalizedTitleBatchItem,
} from '@kino/core/localization'

export type LifetimeStoryTitle = ProfileLifetimeRecap['topRatedMovies'][number]

export type DisplayedLifetimeStoryItems = {
  featuredMovie: LifetimeStoryTitle | null
  featuredSeries: LifetimeStoryTitle | null
  movieRunnersUp: Array<{
    item: LifetimeStoryTitle
    rank: number
  }>
  seriesRunnersUp: Array<{
    item: LifetimeStoryTitle
    rank: number
  }>
}

export type LifetimePosterPreloadItem = Pick<
  LifetimeStoryTitle,
  'coverImage' | 'title' | 'titleId' | 'tmdbId'
>

type Translator = (key: string, values?: Record<string, string | number>) => string

type FeaturedPillLabels = {
  episodesWatched: string
  ratingShort: string
  watchedTimes: string
}

export function getDisplayedLifetimeStoryItems(
  recap: ProfileLifetimeRecap
): DisplayedLifetimeStoryItems {
  const featuredMovie = recap.topRatedMovies[0] ?? null
  const featuredSeries = recap.topRatedSeries[0] ?? null

  const movieRunnersUp = recap.topRatedMovies.slice(1, 4).map((item, index) => ({
    item,
    rank: index + 2,
  }))

  const seriesRunnersUp = recap.topRatedSeries.slice(1, 4).map((item, index) => ({
    item,
    rank: index + 2,
  }))

  return {
    featuredMovie,
    featuredSeries,
    movieRunnersUp,
    seriesRunnersUp,
  }
}

export function getDisplayedLifetimeTitles(displayed: DisplayedLifetimeStoryItems) {
  return [
    ...(displayed.featuredMovie ? [displayed.featuredMovie] : []),
    ...displayed.movieRunnersUp.map(({ item }) => item),
    ...(displayed.featuredSeries ? [displayed.featuredSeries] : []),
    ...displayed.seriesRunnersUp.map(({ item }) => item),
  ]
}

export function buildLifetimeLocalizationRequest(
  displayed: DisplayedLifetimeStoryItems,
  language: string
) {
  const items: LocalizedTitleBatchItem[] = getUniqueLifetimeTitles(displayed).map((item) => ({
    tmdbId: item.tmdbId,
    type: item.mediaType === 'tv' ? 'tv' : 'movie',
  }))

  return {
    schemaVersion: LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
    items,
    locale: language,
    region: localeRegion(language) ?? 'US',
  }
}

export function buildLifetimePosterPreloadItems(
  displayed: DisplayedLifetimeStoryItems
): LifetimePosterPreloadItem[] {
  return getUniqueLifetimeTitles(displayed).map((item) => ({
    coverImage: item.coverImage ?? null,
    title: item.title,
    titleId: item.titleId,
    tmdbId: item.tmdbId,
  }))
}

export function formatKinoMembership(
  createdAt: string,
  t: Translator,
  now = new Date()
) {
  const created = new Date(createdAt)
  const safeCreated = Number.isNaN(created.getTime()) ? now : created
  const duration = getElapsedCalendarDuration(safeCreated, now)
  const createdYear = safeCreated.getFullYear()

  const kinoTime =
    duration.years >= 1
      ? t('stats.story.kinoTimeYears', { count: duration.years })
      : duration.months >= 1
        ? t('stats.story.kinoTimeMonths', { count: duration.months })
        : t('stats.story.kinoTimeDays', { count: duration.days })

  return {
    kinoTime,
    memberSince: t('stats.story.memberSince', { year: createdYear }),
  }
}

export function getLifetimeFeaturedMoviePills(
  item: LifetimeStoryTitle | null,
  labels: Pick<FeaturedPillLabels, 'ratingShort' | 'watchedTimes'>,
  language: string
) {
  if (!item) return []

  const rating = formatRating(item.rating, language)

  return [
    rating
      ? {
          id: 'rating',
          text: `${labels.ratingShort} ${rating}`,
        }
      : null,
    item.count > 0
      ? {
          id: 'diary-count',
          text: `${labels.watchedTimes} ${item.count}×`,
        }
      : null,
  ].filter(isStoryPill)
}

export function getLifetimeFeaturedSeriesPills(
  item: LifetimeStoryTitle | null,
  labels: Pick<FeaturedPillLabels, 'episodesWatched' | 'ratingShort'>,
  language: string
) {
  if (!item) return []

  const rating = formatRating(item.rating, language)
  const watchedEpisodeCount = item.watchedEpisodeCount ?? item.count

  return [
    rating
      ? {
          id: 'rating',
          text: `${labels.ratingShort} ${rating}`,
        }
      : null,
    watchedEpisodeCount > 0
      ? {
          id: 'episodes',
          text: `${watchedEpisodeCount} ${labels.episodesWatched.toLocaleLowerCase(language)}`,
        }
      : null,
  ].filter(isStoryPill)
}

function getUniqueLifetimeTitles(displayed: DisplayedLifetimeStoryItems) {
  return Array.from(
    new Map(getDisplayedLifetimeTitles(displayed).map((item) => [item.titleId, item])).values()
  )
}

function formatRating(rating: number | null | undefined, language: string) {
  return rating != null
    ? new Intl.NumberFormat(language, {
        maximumFractionDigits: 1,
      }).format(rating)
    : null
}

function isStoryPill(
  pill: {
    id: string
    text: string
  } | null
): pill is {
  id: string
  text: string
} {
  return Boolean(pill)
}

function getElapsedCalendarDuration(start: Date, end: Date) {
  if (start > end) {
    return {
      years: 0,
      months: 0,
      days: 0,
    }
  }

  const years = fullCalendarYearsBetween(start, end)
  const months = fullCalendarMonthsBetween(start, end)
  const days = Math.max(
    0,
    Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000)
  )

  return {
    years,
    months,
    days,
  }
}

function fullCalendarYearsBetween(start: Date, end: Date) {
  let years = end.getFullYear() - start.getFullYear()
  const anniversary = createClampedAnniversary(start, start.getFullYear() + years, start.getMonth())

  if (anniversary > end) {
    years -= 1
  }

  return Math.max(0, years)
}

function fullCalendarMonthsBetween(start: Date, end: Date) {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
  const anniversary = createClampedAnniversary(
    start,
    start.getFullYear(),
    start.getMonth() + months
  )

  if (anniversary > end) {
    months -= 1
  }

  return Math.max(0, months)
}

function createClampedAnniversary(start: Date, year: number, month: number) {
  const targetMonth = new Date(year, month, 1)
  const daysInTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate()

  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(start.getDate(), daysInTargetMonth),
    start.getHours(),
    start.getMinutes(),
    start.getSeconds(),
    start.getMilliseconds()
  )
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}
