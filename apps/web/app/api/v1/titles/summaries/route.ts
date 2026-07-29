import { TMDbService } from '@kino/core'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type {
  LocalizedTitleBatchItem,
  LocalizedTitleBatchResponse,
  ResolvedLocalizedTitleSummary,
} from '@/lib/localized-title-batch'

export const dynamic = 'force-dynamic'

const MAX_BATCH_ITEMS = 40

export async function POST(request: NextRequest) {
  const input = await readInput(request)
  if (!input) {
    return NextResponse.json({ error: 'Invalid localized title batch.' }, { status: 400 })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.warn('Localized title batch unavailable: server TMDB configuration is missing.')
    return NextResponse.json({ error: 'Title localization is unavailable.' }, { status: 503 })
  }

  const tmdb = new TMDbService(apiKey)
  tmdb.setLanguage(input.locale.split(/[-_]/, 1)[0]?.toLowerCase() || 'en')
  const settled = await Promise.allSettled(
    input.items.map(async (item): Promise<ResolvedLocalizedTitleSummary> => {
      const details =
        item.type === 'movie'
          ? await tmdb.getMovieDetails(item.tmdbId)
          : await tmdb.getTVDetails(item.tmdbId)
      return {
        backdropPath: details.backdrop_path,
        id: item.tmdbId,
        mediaType: item.type,
        posterPath: details.poster_path,
        posterResolution: {
          locale: input.locale,
          source: 'tmdb-localized-details',
        },
        title: (item.type === 'movie' ? details.title : details.name) ?? '',
        year: releaseYear(item.type === 'movie' ? details.release_date : details.first_air_date),
      }
    })
  )

  const response: LocalizedTitleBatchResponse = {
    errors: settled.flatMap((result, index) =>
      result.status === 'rejected' ? [input.items[index]!] : []
    ),
    missing: settled.flatMap((result, index) =>
      result.status === 'fulfilled' && !result.value.title ? [input.items[index]!] : []
    ),
    summaries: settled.flatMap((result) =>
      result.status === 'fulfilled' && result.value.title ? [result.value] : []
    ),
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=86400',
    },
  })
}

async function readInput(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return null
  }
  if (!body || typeof body !== 'object') return null
  const candidate = body as { items?: unknown; locale?: unknown; region?: unknown }
  if (
    typeof candidate.locale !== 'string' ||
    !candidate.locale.trim() ||
    typeof candidate.region !== 'string' ||
    !/^[A-Za-z]{2}$/.test(candidate.region) ||
    !Array.isArray(candidate.items) ||
    candidate.items.length === 0 ||
    candidate.items.length > MAX_BATCH_ITEMS
  ) {
    return null
  }

  const items: LocalizedTitleBatchItem[] = []
  const seen = new Set<string>()
  for (const value of candidate.items) {
    if (!value || typeof value !== 'object') return null
    const item = value as { tmdbId?: unknown; type?: unknown }
    if (
      !Number.isSafeInteger(item.tmdbId) ||
      (item.tmdbId as number) <= 0 ||
      (item.type !== 'movie' && item.type !== 'tv')
    ) {
      return null
    }
    const normalized: LocalizedTitleBatchItem = {
      tmdbId: item.tmdbId as number,
      type: item.type,
    }
    const key = `${normalized.type}:${normalized.tmdbId}`
    if (!seen.has(key)) items.push(normalized)
    seen.add(key)
  }

  return {
    items,
    locale: candidate.locale.trim(),
    region: candidate.region.toUpperCase(),
  }
}

function releaseYear(date: string | undefined) {
  const year = Number.parseInt(date?.slice(0, 4) || '', 10)
  return Number.isFinite(year) ? year : null
}
