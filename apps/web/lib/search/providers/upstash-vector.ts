import { localeBaseLanguage, normalizeLocale } from '@kino/core/localization'
import type {
  SearchEntity,
  SearchEntityType,
  SearchProviderCandidate,
  SearchProviderResult,
} from '@kino/core/search'
import { Index, type Requester, type UpstashRequest, type UpstashResponse } from '@upstash/vector'

import {
  isAbortError,
  SearchProviderBoundaryError,
  type VectorSearchProvider,
  type VectorSearchRequest,
} from './vector.ts'

type Fetch = typeof globalThis.fetch

interface CreateUpstashVectorProviderOptions {
  readonly url: string
  readonly token: string
  readonly fetch: Fetch
}

interface UpstashMetadata {
  readonly [key: string]: unknown
  readonly entityType?: unknown
  readonly tmdbId?: unknown
  readonly title?: unknown
  readonly name?: unknown
  readonly overview?: unknown
  readonly releaseDate?: unknown
  readonly locale?: unknown
  readonly posterPath?: unknown
  readonly popularity?: unknown
  readonly voteCount?: unknown
}

interface UpstashQueryResult {
  readonly id: number | string
  readonly score: number
  readonly vector?: number[]
  readonly sparseVector?: { readonly indices: number[]; readonly values: number[] }
  readonly metadata?: UpstashMetadata
  readonly data?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text.length > 0 ? text : undefined
}

function entityType(value: unknown): SearchEntityType | undefined {
  return value === 'movie' || value === 'series' || value === 'person' ? value : undefined
}

function releaseYear(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})/u.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  return year >= 1870 && year <= 2100 ? year : undefined
}

function tmdbImageUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/[^/]/u.test(value)
    ? `https://image.tmdb.org/t/p/w500${value}`
    : undefined
}

function localeRelevance(candidateLocale: string | undefined, requestLocale: string | undefined) {
  if (!candidateLocale || !requestLocale) return undefined
  try {
    const candidate = normalizeLocale(candidateLocale)
    const request = normalizeLocale(requestLocale)
    if (candidate === request) return 1
    return localeBaseLanguage(candidate) === localeBaseLanguage(request) ? 0.8 : 0.25
  } catch {
    return undefined
  }
}

function normalizeUpstashResult(
  value: unknown,
  request: VectorSearchRequest
): SearchProviderCandidate | null {
  if (!isRecord(value) || !isRecord(value.metadata)) return null
  const metadata = value.metadata as UpstashMetadata
  const type = entityType(metadata.entityType)
  const tmdbId = metadata.tmdbId
  const title = optionalText(type === 'person' ? metadata.name : metadata.title)
  const score = optionalFiniteNumber(value.score)
  if (!type || !isPositiveInteger(tmdbId) || !title || score === undefined) return null

  const summary = optionalText(metadata.overview)
  const year = releaseYear(metadata.releaseDate)
  const locale = optionalText(metadata.locale)
  const imageUrl = tmdbImageUrl(metadata.posterPath)
  const popularity = optionalFiniteNumber(metadata.popularity)
  const voteCount = optionalFiniteNumber(metadata.voteCount)
  const relevance = localeRelevance(locale, request.locale)
  const entity: SearchEntity = {
    id: `${type}:${tmdbId}`,
    entityType: type,
    tmdbId,
    title,
    ...(summary === undefined ? {} : { summary }),
    ...(year === undefined ? {} : { year }),
    ...(locale === undefined ? {} : { locale }),
    ...(imageUrl === undefined ? {} : { imageUrl }),
    ...(popularity === undefined ? {} : { popularity }),
    ...(voteCount === undefined ? {} : { voteCount }),
  }

  if (type === 'person') {
    return {
      source: 'person',
      confidence: Math.max(0, Math.min(1, score)),
      entity: { ...entity, entityType: 'person' },
      ...(relevance === undefined ? {} : { localeRelevance: relevance }),
    }
  }
  return {
    source: 'semantic',
    semanticScore: Math.max(0, Math.min(1, score)),
    entity,
    ...(relevance === undefined ? {} : { localeRelevance: relevance }),
  }
}

function quoteFilterValue(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function metadataFilter(request: VectorSearchRequest): string | undefined {
  const clauses: string[] = []
  if (request.locale) {
    clauses.push(`locale = ${quoteFilterValue(normalizeLocale(request.locale))}`)
  } else if (request.region) {
    clauses.push(`locale GLOB ${quoteFilterValue(`*-${request.region.toUpperCase()}`)}`)
  }
  if (request.mediaTypes?.length) {
    const entityTypes = [...new Set([...request.mediaTypes, 'person'])]
    clauses.push(`entityType IN (${entityTypes.map(quoteFilterValue).join(', ')})`)
  }
  return clauses.length === 0 ? undefined : clauses.join(' AND ')
}

function createRequester(
  options: CreateUpstashVectorProviderOptions,
  signal: AbortSignal | undefined
): Requester {
  return {
    async request<TResult>(request: UpstashRequest): Promise<UpstashResponse<TResult>> {
      const path = request.path?.join('/') ?? ''
      let response: Response
      try {
        response = await options.fetch(`${options.url.replace(/\/+$/u, '')}/${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${options.token}`,
          },
          body: JSON.stringify(request.body),
          cache: 'no-store',
          signal,
        })
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw error
        throw new SearchProviderBoundaryError('provider_unavailable')
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw new SearchProviderBoundaryError('provider_response_invalid')
      }
      if (!response.ok) throw new SearchProviderBoundaryError('provider_unavailable')
      if (!isRecord(payload) || !Array.isArray(payload.result)) {
        throw new SearchProviderBoundaryError('provider_response_invalid')
      }
      return payload as UpstashResponse<TResult>
    },
  }
}

export function createUpstashVectorProvider(
  options: CreateUpstashVectorProviderOptions
): VectorSearchProvider {
  return {
    async search(request, signal): Promise<SearchProviderResult> {
      if (signal?.aborted) throw signal.reason
      const index = new Index<UpstashMetadata>(createRequester(options, signal))
      let raw: UpstashQueryResult[]
      try {
        const filter = metadataFilter(request)
        raw = await index.query<UpstashMetadata>({
          data: request.query,
          topK: request.topK,
          includeMetadata: true,
          ...(filter === undefined ? {} : { filter }),
        })
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw error
        if (error instanceof SearchProviderBoundaryError) throw error
        throw new SearchProviderBoundaryError('provider_unavailable')
      }
      const candidates = raw
        .map((candidate) => normalizeUpstashResult(candidate, request))
        .filter((candidate): candidate is SearchProviderCandidate => candidate !== null)
      return {
        sourceId: 'vector',
        candidates,
        ...(candidates.length === raw.length ? {} : { degraded: true }),
      }
    },
  }
}
