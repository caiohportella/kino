import { createSearchGateway } from '../../../../lib/search/gateway.ts'
import type { SearchGatewayEventSink } from '../../../../lib/search/observability.ts'
import { createTmdbSearchProvider } from '../../../../lib/search/providers/tmdb.ts'
import { createUpstashVectorProvider } from '../../../../lib/search/providers/upstash-vector.ts'
import {
  createFallbackSearchRateLimiter,
  createMemorySearchRateLimiter,
  createTrustedStoreSearchRateLimiter,
  createUpstashRedisRateLimitStore,
  searchClientKey,
} from '../../../../lib/search/rate-limit.ts'
import { createSearchRouteHandler } from '../../../../lib/search/route-handler.ts'
import {
  readRedisServerEnv,
  readTmdbServerApiKey,
  readVectorServerEnv,
} from '../../../../lib/search/server-env.ts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const localRateLimiter = createMemorySearchRateLimiter({
  limit: 60,
  windowMs: 60_000,
  maxKeys: process.env.NODE_ENV === 'production' ? 10_000 : 1,
})

function productionRateLimiter() {
  const config = readRedisServerEnv()
  if (!config) return localRateLimiter
  return createFallbackSearchRateLimiter({
    primary: createTrustedStoreSearchRateLimiter({
      limit: 60,
      windowMs: 60_000,
      store: createUpstashRedisRateLimitStore({ ...config, fetch: globalThis.fetch }),
    }),
    fallback: localRateLimiter,
  })
}

const eventSink: SearchGatewayEventSink = {
  emit(event) {
    console.info(JSON.stringify(event))
  },
}

export async function POST(request: Request): Promise<Response> {
  const tmdbApiKey = readTmdbServerApiKey()
  if (!tmdbApiKey) {
    return Response.json(
      { error: { code: 'temporary_unavailable', retryable: true } },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    )
  }

  try {
    const vectorConfig = readVectorServerEnv()
    const tmdb = createTmdbSearchProvider({ apiKey: tmdbApiKey, fetch: globalThis.fetch })
    const gateway = createSearchGateway({
      tmdb,
      telemetry: eventSink,
      ...(vectorConfig
        ? {
            vector: createUpstashVectorProvider({
              ...vectorConfig,
              fetch: globalThis.fetch,
            }),
          }
        : {}),
    })
    return createSearchRouteHandler({
      gateway,
      rateLimiter:
        process.env.NODE_ENV === 'production' ? productionRateLimiter() : localRateLimiter,
      clientKey:
        process.env.NODE_ENV === 'production' ? searchClientKey : () => 'local-development',
      eventSink,
    })(request)
  } catch {
    return Response.json(
      { error: { code: 'temporary_unavailable', retryable: true } },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    )
  }
}
