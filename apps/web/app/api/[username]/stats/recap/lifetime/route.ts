import { getTMDbImageUrl, KinoDatabaseService, type ProfileLifetimeRecap } from '@kino/core'
import { createClient } from '@supabase/supabase-js'
import { ImageResponse } from 'next/og'
import { createElement } from 'react'

import { createTmdbLocalizedTitleBatchService } from '@/lib/localization/localized-title-batch-server'
import { getRequestLanguage, getTranslations } from '@/lib/localization/server-localization'
import { loadOgFonts } from '@/lib/og/og-fonts'
import { safeImageData } from '@/lib/og/og-images'
import {
  buildLifetimeLocalizationRequest,
  buildLifetimePosterPreloadItems,
  type DisplayedLifetimeStoryItems,
  formatKinoMembership,
  getDisplayedLifetimeStoryItems,
  getLifetimeFeaturedMoviePills,
  getLifetimeFeaturedSeriesPills,
} from '@/lib/profile/profile-lifetime-recap-story'
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

export const runtime = 'nodejs'

type SafeImageData = StoryImageData
type PosterImages = Map<string, SafeImageData>
type LifetimeTitle = ProfileLifetimeRecap['topRatedMovies'][number]

type StoryLabels = {
  lifetimeRecap: string
  lifetimeHeadline: string
  sinceBeginning: string
  topMovie: string
  topSeries: string
  otherFavoritesMovies: string
  otherFavoritesSeries: string
  trackYoursAt: string
  timeWatched: string
  moviesWatched: string
  episodesWatched: string
  ratingsMade: string
  ratingShort: string
  watchedTimes: string
  kinoTimeValue: string
  memberSince: string
  mostRatedGenre: string
  highestRatedGenre: string
  highestRatedDecade: string
  highestRatedStudio: string
  highestRatedActor: string
  highestRatedActress: string
}

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
    .select('id,username,display_name,created_at')
    .ilike('username', username)
    .maybeSingle()

  if (error) throw error

  return data
}

async function localizeLifetimeRecap(
  recap: ProfileLifetimeRecap,
  language: string,
  signal?: AbortSignal
): Promise<ProfileLifetimeRecap> {
  const apiKey = process.env.TMDB_API_KEY

  if (!apiKey) {
    console.warn('Lifetime recap title localization unavailable: TMDB configuration is missing.')
    return recap
  }

  const request = buildLifetimeLocalizationRequest(getDisplayedLifetimeStoryItems(recap), language)

  if (request.items.length === 0) return recap

  localizedTitleService ??= createTmdbLocalizedTitleBatchService(apiKey)

  const localized = await localizedTitleService.resolve(request, signal)

  const summaries = new Map(
    localized.summaries.map((summary) => [`${summary.mediaType}:${summary.id}`, summary])
  )

  function localizeItem<T extends LifetimeTitle>(item: T, type: 'movie' | 'tv'): T {
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
  }
}

async function preloadPosterImages(displayed: DisplayedLifetimeStoryItems): Promise<PosterImages> {
  return new Map(
    await Promise.all(
      buildLifetimePosterPreloadItems(displayed).map(async (item) => {
        if (!item.coverImage) {
          return [item.titleId, null] as const
        }

        const url = getTMDbImageUrl(item.coverImage, 'w300')

        if (!url) {
          return [item.titleId, null] as const
        }

        const image = await safeImageData(url)

        if (!image) {
          console.warn('[lifetime-recap-story] poster fetch failed', {
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
    }>
  }
) {
  const routeParams = await params
  const username = normalizeProfileUsername(routeParams.username)

  if (!username || isReservedProfileRoute(username)) {
    return new Response('Not found', { status: 404 })
  }

  const profile = await getProfile(username)

  if (!profile) {
    return new Response('Not found', { status: 404 })
  }

  const language = await getRequestLanguage()
  const t = await getTranslations(language)
  const service = new KinoDatabaseService(getClient())

  const rawRecap = await service.getProfileLifetimeRecapByProfileId(profile.id)
  const recap = await localizeLifetimeRecap(rawRecap, language, request.signal)
  const displayed = getDisplayedLifetimeStoryItems(recap)
  const posterImages = await preloadPosterImages(displayed)

  const requestUrl = new URL(request.url)
  const host = requestUrl.host
  const logoUrl = new URL('/kino-logo.png', request.url).toString()
  const name = profile.display_name || profile.username || 'Kino member'
  const membership = formatKinoMembership(profile.created_at, t)

  const localizedMostRatedGenre = recap.mostRatedGenre
    ? recap.mostRatedGenre.id != null
      ? t(`genres.${recap.mostRatedGenre.id}`, {
          defaultValue: recap.mostRatedGenre.name,
        })
      : recap.mostRatedGenre.name
    : '—'

  const localizedHighestRatedGenre = recap.highestRatedGenre
    ? recap.highestRatedGenre.id != null
      ? t(`genres.${recap.highestRatedGenre.id}`, {
          defaultValue: recap.highestRatedGenre.name,
        })
      : recap.highestRatedGenre.name
    : '—'

  const highestRatedDecadeLabel = recap.highestRatedDecade
    ? `${recap.highestRatedDecade.startYear}s`
    : '—'

  const labels: StoryLabels = {
    lifetimeRecap: t('stats.lifetimeRecap', { defaultValue: 'Lifetime recap' }),
    lifetimeHeadline: t('stats.story.lifetimeHeadline', {
      name,
      defaultValue: 'The journey of {{ name }} on Kino',
    }),
    sinceBeginning: t('stats.story.sinceBeginning', { defaultValue: 'membro desde ' }),

    topMovie: t('stats.story.topMovie', { defaultValue: 'Top movie' }),
    topSeries: t('stats.story.topSeries'),

    otherFavoritesMovies: t('stats.story.otherFavoritesMovies'),
    otherFavoritesSeries: t('stats.story.otherFavoritesSeries'),

    trackYoursAt: t('stats.story.trackYoursAt', { host }),

    timeWatched: t('stats.timeWatched'),
    moviesWatched: t('stats.moviesWatched'),
    episodesWatched: t('stats.episodesWatched'),
    ratingsMade: t('stats.ratingsMade'),

    ratingShort: t('stats.story.ratingShort', {
      defaultValue: 'Rating',
    }),
    watchedTimes: t('stats.story.watchedTimes', {
      defaultValue: 'Watched',
    }),

    kinoTimeValue: membership.kinoTime,
    memberSince: membership.memberSince,

    mostRatedGenre: t('stats.mostRatedGenre'),
    highestRatedGenre: t('stats.highestRatedGenre'),
    highestRatedDecade: t('stats.highestRatedDecade'),
    highestRatedStudio: t('stats.highestRatedStudio'),
    highestRatedActor: t('stats.highestRatedActor'),
    highestRatedActress: t('stats.highestRatedActress'),
  }

  const fonts = await loadOgFonts()
  const hasCustomFonts = fonts.length > 0

  return new ImageResponse(
    createElement(StoryImage, {
      hasCustomFonts,
      labels,
      language,
      localizedHighestRatedGenre,
      localizedMostRatedGenre,
      highestRatedDecadeLabel,
      logoUrl,
      posterImages,
      recap,
      displayed,
    }),
    {
      width: 1080,
      height: 1920,
      ...(hasCustomFonts ? { fonts } : {}),
      headers: {
        'cache-control': 'private, no-store',
        'content-disposition': `attachment; filename="kino-${username}-lifetime-recap.png"`,
      },
    }
  )
}

function StoryImage({
  hasCustomFonts,
  labels,
  language,
  localizedHighestRatedGenre,
  localizedMostRatedGenre,
  highestRatedDecadeLabel,
  displayed,
  logoUrl,
  posterImages,
  recap,
}: {
  hasCustomFonts: boolean
  labels: StoryLabels
  language: string
  localizedHighestRatedGenre: string
  localizedMostRatedGenre: string
  highestRatedDecadeLabel: string
  displayed: DisplayedLifetimeStoryItems
  logoUrl: string
  posterImages: PosterImages
  recap: ProfileLifetimeRecap
}) {
  const { featuredMovie, featuredSeries, movieRunnersUp, seriesRunnersUp } = displayed

  const watchTime = formatWatchTimeCompact(recap.timeWatchedMinutes, language)

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
        eyebrow: labels.lifetimeRecap,
        logoUrl,
      }),

      createElement(StoryHeader, {
        eyebrow: labels.sinceBeginning,
        title: labels.lifetimeHeadline,
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
            label: labels.ratingsMade,
            value: String(recap.ratingsMade),
          },
          {
            label: labels.sinceBeginning,
            subtitle: labels.memberSince,
            value: labels.kinoTimeValue,
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
        highestRatedActressName: recap.highestRatedActress?.name ?? '—',
        highestRatedActorName: recap.highestRatedActor?.name ?? '—',
        highestRatedDecadeLabel,
        highestRatedStudioName: recap.highestRatedStudio?.name ?? '—',
        labels,
        localizedHighestRatedGenre,
        localizedMostRatedGenre,
      })
    ),

    createElement(StoryFooter, { text: labels.trackYoursAt })
  )
}

function getFeaturedMovieStoryItem(
  item: LifetimeTitle | null,
  labels: StoryLabels,
  language: string,
  posterImages: PosterImages
): StoryFeaturedItem {
  const title = item?.title ?? labels.topMovie

  return {
    imageSrc: item ? (posterImages.get(item.titleId) ?? null) : null,
    label: labels.topMovie,
    meta: item?.watchTimeMinutes ? formatWatchTimeCompact(item.watchTimeMinutes, language) : null,
    pills: getLifetimeFeaturedMoviePills(item, labels, language),
    title,
  }
}

function getFeaturedSeriesStoryItem(
  item: LifetimeTitle | null,
  labels: StoryLabels,
  language: string,
  posterImages: PosterImages
): StoryFeaturedItem {
  const title = item?.title ?? labels.topSeries

  return {
    imageSrc: item ? (posterImages.get(item.titleId) ?? null) : null,
    label: labels.topSeries,
    meta: item?.watchTimeMinutes ? formatWatchTimeCompact(item.watchTimeMinutes, language) : null,
    pills: getLifetimeFeaturedSeriesPills(item, labels, language),
    title,
  }
}

function getRankedStoryItems(
  items: Array<{
    rank: number
    item: LifetimeTitle
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
  highestRatedActressName,
  highestRatedActorName,
  highestRatedDecadeLabel,
  highestRatedStudioName,
  labels,
  localizedHighestRatedGenre,
  localizedMostRatedGenre,
}: {
  highestRatedActressName: string
  highestRatedActorName: string
  highestRatedDecadeLabel: string
  highestRatedStudioName: string
  labels: StoryLabels
  localizedHighestRatedGenre: string
  localizedMostRatedGenre: string
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
        label: labels.mostRatedGenre,
        value: localizedMostRatedGenre,
        kind: 'text',
      }),

      createElement(StoryStatTile, {
        label: labels.highestRatedGenre,
        value: localizedHighestRatedGenre,
        kind: 'text',
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
        label: labels.highestRatedDecade,
        value: highestRatedDecadeLabel,
        kind: 'text',
      }),

      createElement(StoryStatTile, {
        label: labels.highestRatedStudio,
        value: highestRatedStudioName,
        kind: 'text',
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
        label: labels.highestRatedActor,
        value: highestRatedActorName,
        kind: 'text',
      }),

      createElement(StoryStatTile, {
        label: labels.highestRatedActress,
        value: highestRatedActressName,
        kind: 'text',
      })
    )
  )
}
