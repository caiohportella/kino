import { normalizeLocale } from '@kino/core/localization'
import type {
  LexicalCandidate,
  PersonCandidate,
  PersonCredit,
  SearchEntity,
  SearchMediaType,
  SearchProviderCandidate,
  SearchProviderResult,
} from '@kino/core/search'

import {
  isAbortError,
  SearchProviderBoundaryError,
  type TmdbSearchProvider,
  type TmdbSearchRequest,
} from './vector.ts'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

type Fetch = typeof globalThis.fetch

interface CreateTmdbSearchProviderOptions {
  readonly apiKey: string
  readonly fetch: Fetch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().replace(/\s+/gu, ' ')
  return normalized.length > 0 ? normalized : undefined
}

function imageUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/[^/]/u.test(value)
    ? `${TMDB_IMAGE_BASE}${value}`
    : undefined
}

function year(value: unknown): number | undefined {
  const date = text(value)
  const match = date ? /^(\d{4})/u.exec(date) : null
  if (!match) return undefined
  const parsed = Number(match[1])
  return parsed >= 1870 && parsed <= 2100 ? parsed : undefined
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

function mediaCandidate(
  value: Record<string, unknown>,
  request: TmdbSearchRequest
): LexicalCandidate | null {
  const type: SearchMediaType | undefined =
    value.media_type === 'movie' ? 'movie' : value.media_type === 'tv' ? 'series' : undefined
  const tmdbId = positiveInteger(value.id)
  const title = text(type === 'movie' ? value.title : value.name)
  if (!type || !tmdbId || !title) return null
  if (request.mediaTypes && !request.mediaTypes.includes(type)) return null

  const query = normalizeComparable(request.query)
  const comparableTitle = normalizeComparable(title)
  const exactMatch = comparableTitle === query
  const prefixMatch = !exactMatch && comparableTitle.startsWith(query)
  const summary = text(value.overview)
  const poster = imageUrl(value.poster_path)
  const releaseYear = year(type === 'movie' ? value.release_date : value.first_air_date)
  const popularity = finiteNumber(value.popularity)
  const voteCount = finiteNumber(value.vote_count)
  const entity: SearchEntity = {
    id: `${type}:${tmdbId}`,
    entityType: type,
    tmdbId,
    title,
    ...(summary === undefined ? {} : { summary }),
    ...(poster === undefined ? {} : { imageUrl: poster }),
    ...(releaseYear === undefined ? {} : { year: releaseYear }),
    ...(request.locale === undefined ? {} : { locale: request.locale }),
    ...(popularity === undefined ? {} : { popularity }),
    ...(voteCount === undefined ? {} : { voteCount }),
  }

  return {
    source: 'lexical',
    lexicalScore: exactMatch ? 1 : prefixMatch ? 0.85 : 0.6,
    entity,
    ...(exactMatch ? { exactMatch: true } : {}),
    ...(prefixMatch ? { prefixMatch: true } : {}),
  }
}

function personCandidate(
  value: Record<string, unknown>,
  request: TmdbSearchRequest
): PersonCandidate | null {
  if (value.media_type !== 'person') return null
  const tmdbId = positiveInteger(value.id)
  const name = text(value.name)
  if (!tmdbId || !name) return null
  const profile = imageUrl(value.profile_path)
  const popularity = finiteNumber(value.popularity)
  const entity: SearchEntity & { readonly entityType: 'person' } = {
    id: `person:${tmdbId}`,
    entityType: 'person',
    tmdbId,
    title: name,
    ...(profile === undefined ? {} : { imageUrl: profile }),
    ...(request.locale === undefined ? {} : { locale: request.locale }),
    ...(popularity === undefined ? {} : { popularity }),
  }
  return {
    source: 'person',
    confidence: normalizeComparable(name) === normalizeComparable(request.query) ? 1 : 0.85,
    entity,
  }
}

function roleForCredit(value: Record<string, unknown>): PersonCredit['role'] | undefined {
  const job = text(value.job)?.toLocaleLowerCase('en-US')
  const department = text(value.department)?.toLocaleLowerCase('en-US')
  if (job === 'director' || department === 'directing') return 'directing'
  if (job === 'creator' || department === 'creator') return 'creating'
  if (job === 'writer' || job === 'screenplay' || department === 'writing') return 'writing'
  if (value.character !== undefined) return 'acting'
  return undefined
}

function credit(value: unknown): PersonCredit | null {
  if (!isRecord(value)) return null
  const type: SearchMediaType | undefined =
    value.media_type === 'movie' ? 'movie' : value.media_type === 'tv' ? 'series' : undefined
  const tmdbId = positiveInteger(value.id)
  const title = text(type === 'movie' ? value.title : value.name)
  const role = roleForCredit(value)
  if (!type || !tmdbId || !title || !role) return null
  const releaseYear = year(type === 'movie' ? value.release_date : value.first_air_date)
  const castOrder =
    typeof value.order === 'number' && Number.isInteger(value.order) && value.order >= 0
      ? value.order
      : undefined
  return {
    entity: {
      id: `${type}:${tmdbId}`,
      entityType: type,
      tmdbId,
      title,
      ...(releaseYear === undefined ? {} : { year: releaseYear }),
    },
    role,
    ...(castOrder === undefined ? {} : { castOrder }),
    ...(['Self', 'Himself', 'Herself'].includes(String(value.character))
      ? { appearance: 'self' as const }
      : {}),
  }
}

export function createTmdbSearchProvider(
  options: CreateTmdbSearchProviderOptions
): TmdbSearchProvider {
  async function request(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    if (signal?.aborted) throw signal.reason
    const url = new URL(`${TMDB_API_BASE}${path}`)
    url.search = new URLSearchParams({ api_key: options.apiKey, ...params }).toString()
    let response: Response
    try {
      response = await options.fetch(url, { signal, cache: 'no-store' })
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error
      throw new SearchProviderBoundaryError('provider_unavailable')
    }
    if (!response.ok) throw new SearchProviderBoundaryError('provider_unavailable')
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new SearchProviderBoundaryError('provider_response_invalid')
    }
    if (!isRecord(payload)) throw new SearchProviderBoundaryError('provider_response_invalid')
    return payload
  }

  return {
    async search(requestInput, signal): Promise<SearchProviderResult> {
      const normalizedRequest = {
        ...requestInput,
        ...(requestInput.locale === undefined
          ? {}
          : { locale: normalizeLocale(requestInput.locale) }),
      }
      const payload = await request(
        '/search/multi',
        {
          query: normalizedRequest.query,
          page: String(normalizedRequest.page ?? 1),
          ...(normalizedRequest.locale === undefined ? {} : { language: normalizedRequest.locale }),
          ...(normalizedRequest.region === undefined ? {} : { region: normalizedRequest.region }),
        },
        signal
      )
      if (!Array.isArray(payload.results)) {
        throw new SearchProviderBoundaryError('provider_response_invalid')
      }
      const candidates = payload.results
        .map((result): SearchProviderCandidate | null => {
          if (!isRecord(result)) return null
          return (
            mediaCandidate(result, normalizedRequest) ?? personCandidate(result, normalizedRequest)
          )
        })
        .filter((candidate): candidate is SearchProviderCandidate => candidate !== null)
      return { sourceId: 'tmdb', candidates }
    },

    async getPersonCredits(personId, signal): Promise<readonly PersonCredit[]> {
      const payload = await request(`/person/${personId}/combined_credits`, {}, signal)
      if (!Array.isArray(payload.cast) || !Array.isArray(payload.crew)) {
        throw new SearchProviderBoundaryError('provider_response_invalid')
      }
      return [...payload.cast, ...payload.crew]
        .map(credit)
        .filter((item): item is PersonCredit => item !== null)
    },
  }
}
