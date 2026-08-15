import {
  type LocalizedTitleBatchItem,
  normalizeLocalizedTitleBatchRequest,
} from '@kino/core/localization'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createLocalizedTitleRateLimiter,
  createTmdbLocalizedTitleBatchService,
} from '@/lib/localized-title-batch-server'

const rateLimiter = createLocalizedTitleRateLimiter({
  limit: 30,
  windowMs: 60_000,
})
let service: ReturnType<typeof createTmdbLocalizedTitleBatchService> | undefined

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
    service ??= createTmdbLocalizedTitleBatchService(apiKey)
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

function clientIdentifier(request: NextRequest) {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',', 1)[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim() ||
    'anonymous'
  )
}
