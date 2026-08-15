import { createSearchGateway } from '../../../../lib/search/gateway.ts'
import type { SearchGatewayEventSink } from '../../../../lib/search/observability.ts'
import { PERSON_RELATIONSHIP_MAX_CREDITS } from '../../../../lib/search/person-relationships.ts'
import {
  createPersonRelationshipCache,
  createUpstashPersonRelationshipStore,
  type PersonRelationshipCache,
} from '../../../../lib/search/providers/person-relationship-cache.ts'
import { createTmdbSearchProvider } from '../../../../lib/search/providers/tmdb.ts'
import { createSupabaseUserSearchFallback } from '../../../../lib/search/providers/users.ts'
import {
  createFallbackSearchRateLimiter,
  createMemorySearchRateLimiter,
  createTrustedStoreSearchRateLimiter,
  createUpstashRedisRateLimitStore,
  searchClientKey,
} from '../../../../lib/search/rate-limit.ts'
import { createSearchRouteHandler } from '../../../../lib/search/route-handler.ts'
import { readRedisServerEnv, readTmdbServerApiKey } from '../../../../lib/search/server-env.ts'
import { createRedisSearchClient } from '../../../../lib/search/upstash/client.ts'
import { createPersonIndexer } from '../../../../lib/search/upstash/person-indexer.ts'
import { createTitleIndexer } from '../../../../lib/search/upstash/title-indexer.ts'
import { createRedisTitleSearchProvider } from '../../../../lib/search/upstash/title-search-provider.ts'
import { createRedisUserSearchProvider } from '../../../../lib/search/upstash/user-search-provider.ts'
import { createServerSupabaseClient } from '../../../../lib/supabase/server.ts'

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
    const redisConfig = readRedisServerEnv()
    const redis = redisConfig ? createRedisSearchClient(redisConfig) : undefined
    const supabase = await createServerSupabaseClient()
    const tmdb = createTmdbSearchProvider({ apiKey: tmdbApiKey, fetch: globalThis.fetch })
    const titleIndexer = redisConfig ? createTitleIndexer(redisConfig) : undefined
    const personIndexer = redisConfig ? createPersonIndexer(redisConfig) : undefined
    let relationships: PersonRelationshipCache | undefined
    if (redisConfig) {
      relationships = createPersonRelationshipCache({
        store: createUpstashPersonRelationshipStore({
          ...redisConfig,
          fetch: globalThis.fetch,
        }),
        scheduler: {
          async schedule({ personId }) {
            const credits = await tmdb.getPersonCredits(personId)
            const boundedCredits = credits.slice(0, PERSON_RELATIONSHIP_MAX_CREDITS)
            await relationships?.set({
              schemaVersion: 1,
              personId,
              aliases: [],
              knownForDepartment: null,
              movieCredits: boundedCredits.filter((credit) => credit.entity.entityType === 'movie'),
              tvCredits: boundedCredits.filter((credit) => credit.entity.entityType === 'series'),
              complete: true,
              updatedAt: new Date().toISOString(),
            })
          },
        },
      })
    }

    const titleSearch = redis
      ? createRedisTitleSearchProvider({
          redis,
          defaultLimit: 20,
        })
      : undefined
    const userSearch = createRedisUserSearchProvider({
      ...(redis ? { redis } : {}),
      defaultLimit: 20,
      searchUsersFallback: createSupabaseUserSearchFallback(supabase),
    })

    const gateway = createSearchGateway({
      tmdb,
      telemetry: eventSink,
      ...(relationships ? { relationships } : {}),
      ...(titleSearch ? { vector: titleSearch } : {}),
      ...(titleIndexer ? { titleIndexer } : {}),
      ...(personIndexer ? { personIndexer } : {}),
      users: userSearch,
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
