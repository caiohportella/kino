import type { MediaType } from '@kino/core'
import {
  normalizeFranchiseTitles,
  normalizeWatchProviders,
  resolveWatchProviderRegion,
  selectPreferredTrailer,
  TMDbService,
} from '@kino/core'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tmdbId = Number(id)
  const type: MediaType = request.nextUrl.searchParams.get('type') === 'tv' ? 'tv' : 'movie'
  const language = request.nextUrl.searchParams.get('language') || 'en'
  const requestedRegion = request.nextUrl.searchParams.get('region')

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: 'Invalid title id.' }, { status: 400 })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('TMDB context request failed: server API key is missing.')
    return NextResponse.json({ error: 'TMDB is unavailable.' }, { status: 503 })
  }

  const tmdb = new TMDbService(apiKey)
  tmdb.setLanguage(language)
  const locale = localeForLanguage(language)
  const region = resolveWatchProviderRegion({
    storedRegion: requestedRegion,
    locale,
    defaultRegion: 'US',
  })

  const [videosResult, providersResult, recommendationsResult, detailsResult] =
    await Promise.allSettled([
      tmdb.getVideos(type, tmdbId),
      tmdb.getWatchProviders(type, tmdbId),
      tmdb.getRecommendations(type, tmdbId),
      type === 'movie' ? tmdb.getMovieDetails(tmdbId) : Promise.resolve(null),
    ])

  logFailure('videos', videosResult, tmdbId, type)
  logFailure('watch providers', providersResult, tmdbId, type)
  logFailure('recommendations', recommendationsResult, tmdbId, type)
  logFailure('details', detailsResult, tmdbId, type)

  const collectionId =
    detailsResult.status === 'fulfilled'
      ? detailsResult.value?.belongs_to_collection?.id
      : undefined
  const collectionResult = collectionId
    ? await Promise.allSettled([tmdb.getCollection(collectionId)]).then(([result]) => result)
    : null
  if (collectionResult) logFailure('collection', collectionResult, tmdbId, type)
  const franchiseTitles =
    collectionResult?.status === 'fulfilled'
      ? normalizeFranchiseTitles(collectionResult.value.parts, tmdbId)
      : []
  const franchiseKeys = new Set(
    franchiseTitles.map((item) => `${item.media_type || 'movie'}-${item.id}`)
  )
  const recommendations =
    recommendationsResult.status === 'fulfilled'
      ? recommendationsResult.value
          .filter(
            (item, index, items) =>
              item.id !== tmdbId &&
              !franchiseKeys.has(`${item.media_type || type}-${item.id}`) &&
              items.findIndex(
                (candidate) =>
                  candidate.id === item.id &&
                  (candidate.media_type || type) === (item.media_type || type)
              ) === index
          )
          .slice(0, 12)
      : []

  const videos = videosResult.status === 'fulfilled' ? videosResult.value.results || [] : []
  const providers =
    providersResult.status === 'fulfilled'
      ? normalizeWatchProviders(providersResult.value, region)
      : { groups: {}, link: null, region }

  return NextResponse.json(
    {
      trailer: selectPreferredTrailer(videos, locale),
      providers,
      franchiseTitles,
      recommendations,
      errors: {
        trailer: videosResult.status === 'rejected',
        providers: providersResult.status === 'rejected',
        recommendations: recommendationsResult.status === 'rejected',
        franchise: collectionResult?.status === 'rejected',
      },
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600',
      },
    }
  )
}

function localeForLanguage(language: string) {
  return (
    {
      en: 'en-US',
      fr: 'fr-FR',
      it: 'it-IT',
      no: 'no-NO',
      pt: 'pt-BR',
    }[language] || language
  )
}

function logFailure(
  resource: string,
  result: PromiseSettledResult<unknown>,
  tmdbId: number,
  type: MediaType
) {
  if (result.status === 'rejected') {
    console.error(`TMDB ${resource} request failed for ${type} ${tmdbId}.`, result.reason)
  }
}
