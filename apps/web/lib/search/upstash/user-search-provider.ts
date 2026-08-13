import type { UserProfile } from '@kino/core'
import type { SearchResultV1 } from '@kino/core/search'

import { getKinoSearchIndex, type RedisSearchClientConfig } from './client.ts'
import { buildUserQuery } from './query-filters.ts'
import { scoreUserSearchHit, type UpstashSearchHit } from './ranking.ts'

interface SearchIndexLike {
  query(options: Record<string, unknown>): Promise<readonly UpstashSearchHit[]>
}
export interface UserSearchProvider {
  search(
    request: { readonly query: string; readonly limit: number },
    signal?: AbortSignal
  ): Promise<{ readonly results: readonly SearchResultV1[]; readonly degraded?: boolean }>
}
interface Options extends Partial<RedisSearchClientConfig> {
  readonly searchIndex?: SearchIndexLike
  readonly redis?: unknown
  readonly defaultLimit?: number
  readonly searchUsersFallback?: (
    query: string,
    signal?: AbortSignal
  ) => Promise<readonly UserProfile[]>
}

function dedupe(results: readonly SearchResultV1[]): SearchResultV1[] {
  const map = new Map<string, SearchResultV1>()
  for (const result of results) {
    const previous = map.get(result.entity.id)
    if (!previous || result.score > previous.score)
      map.set(result.entity.id, {
        ...result,
        sources: [...new Set([...(previous?.sources ?? []), ...result.sources])],
      })
  }
  return [...map.values()].sort(
    (a, b) => b.score - a.score || a.entity.title.localeCompare(b.entity.title, 'en')
  )
}

function profileHit(profile: UserProfile): UpstashSearchHit {
  return {
    score: 0.5,
    data: {
      id: profile.id,
      entityType: 'user',
      userId: profile.id,
      username: profile.username ?? '',
      displayName: profile.display_name ?? '',
      avatarUrl: profile.avatar_url,
    },
  }
}

export function createRedisUserSearchProvider(options: Options): UserSearchProvider {
  const searchIndex =
    options.searchIndex ?? (options.redis ? getKinoSearchIndex(options.redis as never) : null)
  return {
    async search(request, signal) {
      if (signal?.aborted) throw signal.reason
      const limit = Math.max(1, Math.min(1000, request.limit || options.defaultLimit || 10))
      let redisResults: SearchResultV1[] = []
      let redisAvailable = Boolean(searchIndex)
      try {
        const hits = searchIndex
          ? await searchIndex.query({ filter: buildUserQuery(request.query), limit })
          : []
        for (const hit of hits) {
          const scored = scoreUserSearchHit({ query: request.query, hit, source: 'redis' })
          if (scored)
            redisResults.push({
              entity: scored.entity,
              score: scored.finalScore,
              sources: ['redis-user'],
            })
        }
      } catch {
        redisAvailable = false
      }
      const needsFallback = !redisAvailable || redisResults.length < Math.min(limit, 5)
      const fallbackResults: SearchResultV1[] = []
      if (needsFallback && options.searchUsersFallback) {
        try {
          for (const profile of await options.searchUsersFallback(request.query, signal)) {
            const scored = scoreUserSearchHit({
              query: request.query,
              hit: profileHit(profile),
              source: 'db',
            })
            if (scored)
              fallbackResults.push({
                entity: scored.entity,
                score: scored.finalScore,
                sources: ['user-db'],
              })
          }
        } catch {
          /* best effort */
        }
      }
      return {
        results: dedupe([...redisResults, ...fallbackResults]).slice(0, limit),
        ...(needsFallback ? { degraded: true } : {}),
      }
    },
  }
}

export const createUpstashUserSearchProvider = createRedisUserSearchProvider
