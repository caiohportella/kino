import type { NextRequest } from 'next/server'

import { createLocalizedTitleRateLimiter } from '@/lib/localization/localized-title-batch-server'
import { createTmdbLocalizedTitleNameBatchService } from '@/lib/localization/localized-title-name-batch-server'
import { createLocalizedTitleNameRouteHandler } from '@/lib/localization/localized-title-name-route'

const rateLimiter = createLocalizedTitleRateLimiter({
  limit: 30,
  windowMs: 60_000,
})

let service: ReturnType<typeof createTmdbLocalizedTitleNameBatchService> | undefined

export async function POST(request: NextRequest) {
  if (!rateLimiter.check(clientIdentifier(request))) {
    return Response.json(
      {
        error: 'Too many localized title requests.',
      },
      {
        status: 429,
      }
    )
  }

  const apiKey = process.env.TMDB_API_KEY

  if (!apiKey) {
    console.warn('Localized title name batch unavailable: server TMDB configuration is missing.')

    return Response.json(
      {
        error: 'Title localization is unavailable.',
      },
      {
        status: 503,
      }
    )
  }

  service ??= createTmdbLocalizedTitleNameBatchService(apiKey)

  const handler = createLocalizedTitleNameRouteHandler(service)

  return handler(request)
}

function clientIdentifier(request: NextRequest) {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',', 1)[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim() ||
    'anonymous'
  )
}
