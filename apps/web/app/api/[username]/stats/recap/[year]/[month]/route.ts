import {
  getTMDbImageUrl,
  KinoDatabaseService,
  localeRegion,
  type ProfileMonthlyRecap,
} from '@kino/core'
import {
  LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
  type LocalizedTitleBatchItem,
} from '@kino/core/localization'
import { createClient } from '@supabase/supabase-js'
import { ImageResponse } from 'next/og'
import { createElement } from 'react'
import { createTmdbLocalizedTitleBatchService } from '@/lib/localization/localized-title-batch-server'
import { getRequestLanguage, getTranslations } from '@/lib/localization/server-localization'
import { loadOgFonts } from '@/lib/og/og-fonts'
import { safeImageData } from '@/lib/og/og-images'
import { formatProfileMonth } from '@/lib/profile/profile-recap'
import {
  type StoryFeaturedItem,
  StoryFeaturedSection,
  StoryFooter,
  StoryHeader,
  type StoryImageData,
  type StoryRankedItem,
  StoryRankedSections,
  StoryStatsOverview,
  StoryStatTile,
  StoryTopBar,
} from '@/lib/profile/profile-recap-story'
import { isReservedProfileRoute, normalizeProfileUsername } from '@/lib/profile/profile-routes'
import { formatWatchTimeCompact } from '@/lib/profile/profile-stats'

type SafeImageData = StoryImageData
type PosterImages = Map<string, SafeImageData>

/**
 * Optional compatibility field for the bottom "series watched" tile.
 * No additional fetch is needed: add this aggregate to ProfileMonthlyRecap
 * when you want that value to be exact.
 */
type StoryMonthlyRecap = ProfileMonthlyRecap & {
  seriesWatched?: number
}

type StoryLabels = {
  monthlyRecap: string
  monthHeadline: string
  topMovie: string
  topSeries: string
  otherFavoritesMovies: string
  otherFavoritesSeries: string
  topGenre: string
  topActor: string
  trackYoursAt: string
  timeWatched: string
  moviesWatched: string
  episodesWatched: string
  activeDays: string
  ratingsMade: string
  seriesWatched: string
  ratingShort: string
  watchedTimes: string
  tvShare: string
}

type FeaturedMovie = StoryMonthlyRecap['topRatedMovies'][number]
type FeaturedSeries = StoryMonthlyRecap['mostWatchedSeries'][number]
type RankedItem =
  | StoryMonthlyRecap['topRatedMovies'][number]
  | StoryMonthlyRecap['topRatedSeries'][number]

export const runtime = 'nodejs'

let localizedTitleService: ReturnType<typeof createTmdbLocalizedTitleBatchService> | undefined

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      'https://example.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      'missing-anon-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

async function getProfile(username: string) {
  const client = getClient()

  const { data, error } = await client
    .from('user_profiles')
    .select('id,username,display_name')
    .ilike('username', username)
    .maybeSingle()

  if (error) throw error

  return data
}

async function localizeMonthlyRecap(
  recap: ProfileMonthlyRecap,
  language: string,
  signal?: AbortSignal
): Promise<ProfileMonthlyRecap> {
  const apiKey = process.env.TMDB_API_KEY

  if (!apiKey) {
    console.warn('Monthly recap title localization unavailable: TMDB configuration is missing.')
    return recap
  }

  const items: LocalizedTitleBatchItem[] = [
    ...recap.topRatedMovies.map((item) => ({
      tmdbId: item.tmdbId,
      type: 'movie' as const,
    })),
    ...recap.topRatedSeries.map((item) => ({
      tmdbId: item.tmdbId,
      type: 'tv' as const,
    })),
    ...recap.mostWatchedSeries.map((item) => ({
      tmdbId: item.tmdbId,
      type: 'tv' as const,
    })),
  ]

  const uniqueItems = Array.from(
    new Map(items.map((item) => [`${item.type}:${item.tmdbId}`, item])).values()
  )

  if (uniqueItems.length === 0) return recap

  localizedTitleService ??= createTmdbLocalizedTitleBatchService(apiKey)

  const localized = await localizedTitleService.resolve(
    {
      schemaVersion: LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
      items: uniqueItems,
      locale: language,
      region: localeRegion(language) ?? 'US',
    },
    signal
  )

  const summaries = new Map(
    localized.summaries.map((summary) => [`${summary.mediaType}:${summary.id}`, summary])
  )

  function localizeItem<
    T extends {
      tmdbId: number
      title: string
      coverImage?: string | null
    },
  >(item: T, type: LocalizedTitleBatchItem['type']): T {
    const summary = summaries.get(`${type}:${item.tmdbId}`)

    if (!summary) return item

    return {
      ...item,
      title: summary.title,
      coverImage: summary.posterPath ?? item.coverImage,
    }
  }

  return {
    ...recap,
    topRatedMovies: recap.topRatedMovies.map((item) => localizeItem(item, 'movie')),
    topRatedSeries: recap.topRatedSeries.map((item) => localizeItem(item, 'tv')),
    mostWatchedSeries: recap.mostWatchedSeries.map((item) => localizeItem(item, 'tv')),
  }
}

function getDisplayedStoryItems(recap: StoryMonthlyRecap) {
  const featuredMovie = recap.topRatedMovies[0] ?? null
  const featuredSeries = recap.mostWatchedSeries[0] ?? null

  const movieRunnersUp = recap.topRatedMovies
    .filter((item) => item.titleId !== featuredMovie?.titleId)
    .slice(0, 3)
    .map((item, index) => ({
      item,
      rank: index + 2,
    }))

  const seriesRunnersUp = recap.topRatedSeries
    .filter((item) => item.titleId !== featuredSeries?.titleId)
    .slice(0, 3)
    .map((item, index) => ({
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

async function preloadPosterImages(recap: StoryMonthlyRecap): Promise<PosterImages> {
  const { featuredMovie, featuredSeries, movieRunnersUp, seriesRunnersUp } =
    getDisplayedStoryItems(recap)

  const items = [
    ...(featuredMovie ? [featuredMovie] : []),
    ...(featuredSeries ? [featuredSeries] : []),
    ...movieRunnersUp.map(({ item }) => item),
    ...seriesRunnersUp.map(({ item }) => item),
  ]

  const uniqueItems = Array.from(new Map(items.map((item) => [item.titleId, item])).values())

  return new Map(
    await Promise.all(
      uniqueItems.map(async (item) => {
        if (!item.coverImage) {
          return [item.titleId, null] as const
        }

        const url = getTMDbImageUrl(item.coverImage, 'w300')

        if (!url) {
          return [item.titleId, null] as const
        }

        const image = await safeImageData(url)

        if (!image) {
          console.warn('[monthly-recap-story] poster fetch failed', {
            titleId: item.titleId,
            tmdbId: item.tmdbId,
            title: item.title,
            url,
          })
        }

        return [item.titleId, image] as const
      })
    )
  )
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      username: string
      year: string
      month: string
    }>
  }
) {
  const routeParams = await params
  const username = normalizeProfileUsername(routeParams.username)
  const year = Number(routeParams.year)
  const month = Number(routeParams.month)
  const requestUrl = new URL(request.url)

  if (
    !username ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    isReservedProfileRoute(username)
  ) {
    return new Response('Not found', { status: 404 })
  }

  const profile = await getProfile(username)

  if (!profile) {
    return new Response('Not found', { status: 404 })
  }

  const language = await getRequestLanguage()
  const t = await getTranslations(language)
  const service = new KinoDatabaseService(getClient())

  const rawRecap = await service.getProfileMonthlyRecapByProfileId(profile.id, year, month)

  const localizedRecap = await localizeMonthlyRecap(rawRecap, language, request.signal)
  const recap = localizedRecap as StoryMonthlyRecap

  const posterImages = await preloadPosterImages(recap)

  const monthLabel = formatProfileMonth(year, month, language)
  const name = profile.display_name || profile.username || 'Kino member'
  const host = requestUrl.host
  const logoUrl = new URL('/kino-logo.png', request.url).toString()

  const topGenre = recap.topGenres[0] ?? null
  const localizedTopGenreName = topGenre
    ? t(`genres.${topGenre.genreId}`, {
        defaultValue: topGenre.name,
      })
    : '—'

  const labels: StoryLabels = {
    monthlyRecap: t('stats.monthlyRecap'),
    monthHeadline: t('stats.story.monthHeadline', { name }),

    topMovie: t('stats.story.topMovie'),
    topSeries: t('stats.story.topSeries'),

    otherFavoritesMovies: t('stats.story.otherFavoritesMovies'),
    otherFavoritesSeries: t('stats.story.otherFavoritesSeries'),

    topGenre: t('stats.story.topGenre'),
    topActor: t('stats.story.topActor'),

    trackYoursAt: t('stats.story.trackYoursAt', { host }),

    timeWatched: t('stats.timeWatched'),
    moviesWatched: t('stats.moviesWatched'),
    episodesWatched: t('stats.episodesWatched'),
    activeDays: t('stats.activeDays'),

    ratingsMade: t('stats.ratingsMade'),
    seriesWatched: t('stats.story.seriesWatched', {
      defaultValue: 'Series watched',
    }),

    ratingShort: t('stats.story.ratingShort', {
      defaultValue: 'Rating',
    }),
    watchedTimes: t('stats.story.watchedTimes', {
      defaultValue: 'Watched',
    }),
    tvShare: t('stats.story.tvShare', {
      defaultValue: 'of TV time',
    }),
  }

  const fonts = await loadOgFonts()
  const hasCustomFonts = fonts.length > 0

  return new ImageResponse(
    createElement(StoryImage, {
      hasCustomFonts,
      labels,
      language,
      localizedTopGenreName,
      logoUrl,
      monthLabel,
      name,
      posterImages,
      recap,
    }),
    {
      width: 1080,
      height: 1920,
      ...(hasCustomFonts ? { fonts } : {}),
      headers: {
        'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    }
  )
}

function StoryImage({
  hasCustomFonts,
  labels,
  language,
  localizedTopGenreName,
  logoUrl,
  monthLabel,
  name,
  posterImages,
  recap,
}: {
  hasCustomFonts: boolean
  labels: StoryLabels
  language: string
  localizedTopGenreName: string
  logoUrl: string
  monthLabel: string
  name: string
  posterImages: PosterImages
  recap: StoryMonthlyRecap
}) {
  const { featuredMovie, featuredSeries, movieRunnersUp, seriesRunnersUp } =
    getDisplayedStoryItems(recap)

  const watchTime = formatWatchTimeCompact(recap.timeWatchedMinutes, language)

  /**
   * Compatibility fallback:
   * mostWatchedSeries is currently capped to five entries in the recap builder.
   * Once `seriesWatched` is added to ProfileMonthlyRecap, this becomes exact.
   */
  const seriesWatched =
    recap.seriesWatched ?? Math.max(recap.mostWatchedSeries.length, recap.topRatedSeries.length)

  const topActor = recap.topActor ?? null

  return createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '50px 56px 42px',
        color: '#f4f7f5',
        background:
          'radial-gradient(circle at 50% 0%, rgba(29,185,84,0.08), transparent 26%), linear-gradient(180deg, #050706 0%, #050605 62%, #030403 100%)',
        fontFamily: hasCustomFonts ? 'Kino Body' : 'sans-serif',
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        },
      },

      createElement(StoryTopBar, {
        eyebrow: labels.monthlyRecap,
        logoUrl,
      }),

      createElement(StoryHeader, {
        eyebrow: monthLabel,
        title: labels.monthHeadline,
      }),

      createElement(StoryStatsOverview, {
        tiles: [
          {
            label: labels.moviesWatched,
            value: String(recap.moviesWatched),
          },
          {
            label: labels.episodesWatched,
            value: String(recap.episodesWatched),
          },
          {
            label: labels.activeDays,
            value: String(recap.activeDays),
          },
          {
            label: labels.ratingsMade,
            value: String(recap.ratingsMade),
          },
        ],
        watchTime,
        watchTimeLabel: labels.timeWatched,
      }),

      createElement(StoryFeaturedSection, {
        items: [
          getFeaturedMovieStoryItem(featuredMovie, labels, language, posterImages),
          getFeaturedSeriesStoryItem(featuredSeries, labels, language, posterImages),
        ],
      }),

      createElement(StoryRankedSections, {
        sections: [
          {
            items: getRankedStoryItems(movieRunnersUp, posterImages),
            title: labels.otherFavoritesMovies,
          },
          {
            items: getRankedStoryItems(seriesRunnersUp, posterImages),
            title: labels.otherFavoritesSeries,
          },
        ],
      }),

      createElement(StatsGrid, {
        labels,
        localizedTopGenreName,
        moviesWatched: recap.moviesWatched,
        seriesWatched,
        topActor,
      })
    ),

    createElement(StoryFooter, { text: labels.trackYoursAt })
  )
}

function getFeaturedMovieStoryItem(
  item: FeaturedMovie | null,
  labels: StoryLabels,
  language: string,
  posterImages: PosterImages
): StoryFeaturedItem {
  const title = item?.title ?? labels.topMovie
  const rating =
    item?.rating != null
      ? new Intl.NumberFormat(language, {
          maximumFractionDigits: 1,
        }).format(item.rating)
      : null
  const watchTime =
    item?.watchTimeMinutes != null && item.watchTimeMinutes > 0
      ? formatWatchTimeCompact(item.watchTimeMinutes, language)
      : null

  const pills = [
    rating
      ? {
          id: 'rating',
          text: `${labels.ratingShort} ${rating}`,
        }
      : null,
    item && item.count > 1
      ? {
          id: 'count',
          text: `${labels.watchedTimes} ${item.count}×`,
        }
      : null,
  ].filter(
    (
      pill
    ): pill is {
      id: string
      text: string
    } => Boolean(pill)
  )

  return {
    imageSrc: item ? (posterImages.get(item.titleId) ?? null) : null,
    label: labels.topMovie,
    meta: watchTime,
    pills,
    title,
  }
}

function getFeaturedSeriesStoryItem(
  item: FeaturedSeries | null,
  labels: StoryLabels,
  language: string,
  posterImages: PosterImages
): StoryFeaturedItem {
  const title = item?.title ?? labels.topSeries
  const watchTime =
    item?.watchTimeMinutes != null && item.watchTimeMinutes > 0
      ? formatWatchTimeCompact(item.watchTimeMinutes, language)
      : null
  const rating =
    item?.rating != null
      ? new Intl.NumberFormat(language, {
          maximumFractionDigits: 1,
        }).format(item.rating)
      : null
  const tvShare =
    item?.percentageOfTvTime != null && item.percentageOfTvTime > 0
      ? `${Math.round(item.percentageOfTvTime)}% ${labels.tvShare}`
      : null

  const meta = item
    ? [`${item.count} ${labels.episodesWatched.toLocaleLowerCase(language)}`, watchTime]
        .filter(Boolean)
        .join(' · ')
    : null

  const pills = [
    rating
      ? {
          id: 'rating',
          text: `${labels.ratingShort} ${rating}`,
        }
      : null,
    tvShare
      ? {
          id: 'share',
          text: tvShare,
        }
      : null,
  ].filter(
    (
      pill
    ): pill is {
      id: string
      text: string
    } => Boolean(pill)
  )

  return {
    imageSrc: item ? (posterImages.get(item.titleId) ?? null) : null,
    label: labels.topSeries,
    meta,
    pills,
    title,
  }
}

function getRankedStoryItems(
  items: Array<{
    rank: number
    item: RankedItem
  }>,
  posterImages: PosterImages
): StoryRankedItem[] {
  return items.map(({ item, rank }) => ({
    imageSrc: posterImages.get(item.titleId) ?? null,
    rank,
    title: item.title,
  }))
}

function StatsGrid({
  labels,
  localizedTopGenreName,
  moviesWatched,
  seriesWatched,
  topActor,
}: {
  labels: StoryLabels
  localizedTopGenreName: string
  moviesWatched: number
  seriesWatched: number
  topActor: StoryMonthlyRecap['topActor']
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          gap: 12,
        },
      },

      createElement(StoryStatTile, {
        label: labels.moviesWatched,
        value: String(moviesWatched),
        kind: 'number',
      }),

      createElement(StoryStatTile, {
        label: labels.seriesWatched,
        value: String(seriesWatched),
        kind: 'number',
      })
    ),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          gap: 12,
        },
      },

      createElement(StoryStatTile, {
        label: labels.topGenre,
        value: localizedTopGenreName,
        kind: 'text',
      }),

      createElement(StoryStatTile, {
        label: labels.topActor,
        value: topActor?.name ?? '—',
        kind: 'text',
      })
    )
  )
}
