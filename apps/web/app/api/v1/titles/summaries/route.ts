import { TMDbService } from '@kino/core'
import {
  type LocalizedTitleBatchItem,
  normalizeLocalizedTitleBatchRequest,
} from '@kino/core/localization'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createLocalizedTitleBatchService,
  createLocalizedTitleRateLimiter,
  type LocalizedTitleProviderResult,
} from '@/lib/localized-title-batch-server'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const rateLimiter = createLocalizedTitleRateLimiter({ limit: 30, windowMs: 60_000 })
let service: ReturnType<typeof createLocalizedTitleBatchService> | undefined

export async function POST(request: NextRequest) {
  if (!rateLimiter.check(clientIdentifier(request))) {
    return NextResponse.json({ error: 'Too many localized title requests.' }, { status: 429 })
  }

  const input = await readInput(request)
  if (!input || input.items.length === 0) {
    return NextResponse.json({ error: 'Invalid localized title batch.' }, { status: 400 })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.warn('Localized title batch unavailable: server TMDB configuration is missing.')
    return NextResponse.json({ error: 'Title localization is unavailable.' }, { status: 503 })
  }

  try {
    service ??= createLocalizedTitleBatchService({
      fetchTitle: (item, context, signal) =>
        fetchLocalizedTitle(apiKey, item, context.locale, signal),
    })
    const response = await service.resolve(input, request.signal)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 499 })
    }
    console.warn('Localized title batch failed.', {
      error: error instanceof Error ? error.name : 'UnknownError',
    })
    return NextResponse.json({ error: 'Title localization is unavailable.' }, { status: 503 })
  }
}

async function readInput(request: NextRequest) {
  try {
    return normalizeLocalizedTitleBatchRequest(await request.json())
  } catch {
    return null
  }
}

async function fetchLocalizedTitle(
  apiKey: string,
  item: LocalizedTitleBatchItem,
  locale: string,
  signal?: AbortSignal
): Promise<LocalizedTitleProviderResult> {
  const tmdb = new TMDbService(apiKey)
  tmdb.setLanguage(locale.split(/[-_]/, 1)[0]?.toLowerCase() || 'en')
  const details =
    item.type === 'movie'
      ? await tmdb.getMovieDetails(item.tmdbId)
      : await tmdb.getTVDetails(item.tmdbId)
  signal?.throwIfAborted()

  const originalLanguage =
    'original_language' in details && typeof details.original_language === 'string'
      ? details.original_language
      : null
  const includeLanguages = [locale, locale.split(/[-_]/, 1)[0], originalLanguage, 'null'].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
  )
  const imagesUrl = new URL(`${TMDB_API_BASE}/${item.type}/${item.tmdbId}/images`)
  imagesUrl.searchParams.set('api_key', apiKey)
  imagesUrl.searchParams.set('include_image_language', includeLanguages.join(','))
  const imagesResponse = await fetch(imagesUrl, { signal })
  if (!imagesResponse.ok) throw new Error(`TMDb images request failed: ${imagesResponse.status}`)
  const images = (await imagesResponse.json()) as {
    backdrops?: LocalizedTitleProviderResult['backdrops']
    posters?: LocalizedTitleProviderResult['posters']
  }

  return {
    backdrops: images.backdrops ?? [],
    backdropPath: details.backdrop_path,
    defaultBackdropPath: details.backdrop_path,
    defaultPosterPath: details.poster_path,
    originalLanguage,
    posters: images.posters ?? [],
    title: (item.type === 'movie' ? details.title : details.name) ?? '',
    year: releaseYear(item.type === 'movie' ? details.release_date : details.first_air_date),
  }
}

function clientIdentifier(request: NextRequest) {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',', 1)[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim() ||
    'anonymous'
  )
}

function releaseYear(date: string | undefined) {
  const year = Number.parseInt(date?.slice(0, 4) || '', 10)
  return Number.isFinite(year) ? year : null
}
