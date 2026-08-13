import type {
  SearchMediaType,
  SearchProviderCandidate,
  SearchProviderResult,
} from '@kino/core/search'

import { getKinoSearchIndex, type RedisSearchClientConfig } from './client.ts'
import { buildPersonQuery, buildTitleQuery } from './query-filters.ts'
import { scorePersonSearchHit, scoreTitleSearchHit, type UpstashSearchHit } from './ranking.ts'

interface SearchIndexLike {
  query(options: Record<string, unknown>): Promise<readonly UpstashSearchHit[]>
}

export interface RedisTitleSearchProviderOptions {
  readonly searchIndex?: SearchIndexLike
  readonly redis?: { search: { index(options: { name: string }): SearchIndexLike } }
  readonly client?: RedisSearchClientConfig
  readonly defaultLimit?: number
  readonly timeoutMs?: number
}

function index(options: RedisTitleSearchProviderOptions) {
  if (options.searchIndex) return options.searchIndex
  if (options.redis) return getKinoSearchIndex(options.redis as never)
  throw new Error('Redis search index is not configured')
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError')
  )
}

export function createRedisTitleSearchProvider(options: RedisTitleSearchProviderOptions) {
  const searchIndex = index(options)
  return {
    async search(
      request: {
        readonly query: string
        readonly topK: number
        readonly locale?: string
        readonly region?: string
        readonly mediaTypes?: readonly SearchMediaType[]
        readonly mode?: 'autocomplete' | 'full'
      },
      signal?: AbortSignal
    ): Promise<SearchProviderResult> {
      if (signal?.aborted) throw signal.reason
      const limit = Math.max(1, Math.min(1000, request.topK || options.defaultLimit || 10))
      const timeout = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined
      try {
        const [titleHits, personHits] = await Promise.all([
          searchIndex.query({
            filter: buildTitleQuery(request.query, {
              autocomplete: request.mode === 'autocomplete',
              mediaTypes: request.mediaTypes,
            }),
            limit,
          }),
          searchIndex.query({
            filter: buildPersonQuery(request.query),
            limit: Math.min(limit, 20),
          }),
        ])
        if (signal?.aborted || timeout?.aborted) throw signal?.reason ?? timeout?.reason
        const candidates: SearchProviderCandidate[] = []
        for (const hit of titleHits) {
          const scored = scoreTitleSearchHit({ query: request.query, hit, source: 'redis' })
          if (!scored) continue
          candidates.push(
            { source: 'semantic', entity: scored.entity, semanticScore: scored.semanticScore },
            {
              source: 'lexical',
              entity: scored.entity,
              lexicalScore: scored.lexicalScore,
              ...(scored.exactMatch ? { exactMatch: true } : {}),
              ...(scored.prefixMatch ? { prefixMatch: true } : {}),
            }
          )
        }
        for (const hit of personHits) {
          const scored = scorePersonSearchHit({ query: request.query, hit, source: 'redis' })
          if (scored)
            candidates.push({
              source: 'person',
              entity: scored.entity,
              confidence: scored.confidence,
            })
        }
        return {
          sourceId: 'redis-search',
          candidates,
          ...(titleHits.length < limit ? { degraded: true } : {}),
        }
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw error
        throw error
      }
    },
  }
}

export const createUpstashTitleSearchProvider = createRedisTitleSearchProvider
