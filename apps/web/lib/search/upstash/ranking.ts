import type { SearchEntityV2, SearchMediaType } from '@kino/core/search'

export interface UpstashSearchHit<TData extends Record<string, unknown> = Record<string, unknown>> {
  readonly key?: string
  readonly id?: string | number
  readonly score: number
  readonly data?: TData
  readonly metadata?: Record<string, unknown>
  readonly content?: Record<string, unknown>
}
export interface TitleSearchScoreDebug {
  readonly query: string
  readonly entityId: string
  readonly upstashScore: number
  readonly exactTitleBoost: number
  readonly exactOriginalTitleBoost: number
  readonly prefixTitleBoost: number
  readonly popularityBoost: number
  readonly voteCountBoost: number
  readonly finalScore: number
  readonly source: 'redis' | 'upstash' | 'tmdb' | 'both'
}
export interface UserSearchScoreDebug {
  readonly query: string
  readonly entityId: string
  readonly upstashScore: number
  readonly exactUsernameBoost: number
  readonly usernamePrefixBoost: number
  readonly exactDisplayNameBoost: number
  readonly finalScore: number
  readonly source: 'redis' | 'upstash' | 'db' | 'both'
}

function bounded(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
}
export function normalizeSearchText(value: string): string {
  return normalizeText(value.trim())
}
export function normalizeUsernameSearchText(value: string): string {
  return normalizeSearchText(value.replace(/^@+/u, ''))
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
}
function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
function yearValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 1800 ? value : undefined
}
function values(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (value && typeof value === 'object') return Object.values(value).flatMap(values)
  return []
}
function dataOf(hit: UpstashSearchHit): Record<string, unknown> {
  if (hit.data) return hit.data
  const metadata = hit.metadata ?? {}
  const content = hit.content ?? {}
  return { ...metadata, ...content, metadata, content }
}
function popularityBoost(value: unknown): number {
  const n = numberValue(value)
  return n === undefined ? 0 : bounded(Math.log10(1 + Math.max(0, n)) / 6)
}
function voteCountBoost(value: unknown): number {
  const n = numberValue(value)
  return n === undefined ? 0 : bounded(Math.log10(1 + Math.max(0, n)) / 6)
}
function signals(query: string, rawValues: readonly string[]) {
  const normalized = rawValues.map(normalizeSearchText).filter(Boolean)
  const exact = normalized.some((value) => value === query)
  const prefix = !exact && normalized.some((value) => value.startsWith(query))
  return {
    exact,
    prefix,
    lexical: exact || prefix || normalized.some((value) => value.includes(query)),
  }
}
function sourceOf(source: string): 'redis' | 'upstash' | 'tmdb' | 'both' {
  return source === 'upstash' || source === 'tmdb' || source === 'both' ? source : 'redis'
}
function userSourceOf(source: string): 'redis' | 'upstash' | 'db' | 'both' {
  return source === 'upstash' || source === 'db' || source === 'both' ? source : 'redis'
}

export function scoreTitleSearchHit(input: {
  readonly query: string
  readonly hit: UpstashSearchHit
  readonly source: 'redis' | 'upstash' | 'tmdb' | 'both'
}) {
  const data = dataOf(input.hit)
  const legacyMetadata = data.metadata as Record<string, unknown> | undefined
  const legacyContent = data.content as Record<string, unknown> | undefined
  const entityType = text(data.entityType ?? legacyMetadata?.entityType)
  const tmdbId = numberValue(data.tmdbId ?? legacyMetadata?.tmdbId)
  const rawType = text(data.mediaType ?? legacyMetadata?.mediaType)
  const mediaType: SearchMediaType | undefined =
    entityType === 'series' || rawType === 'series' || rawType === 'tv'
      ? 'series'
      : entityType === 'movie' || rawType === 'movie'
        ? 'movie'
        : undefined
  const title = text(data.title ?? data.name ?? legacyContent?.name)
  const original = text(data.originalTitle ?? data.originalName ?? legacyContent?.originalName)
  if (!tmdbId || !mediaType || !title) return null
  const query = normalizeSearchText(input.query)
  const match = signals(query, [
    title,
    original,
    ...values(data.aliases ?? legacyContent?.aliases),
    ...values(data.localizedTitles),
  ])
  const score = bounded(input.hit.score)
  const exactTitleBoost = match.exact && normalizeSearchText(title) === query ? 1.6 : 0
  const exactOriginalTitleBoost = !exactTitleBoost && match.exact ? 1.6 : 0
  const prefixTitleBoost = !match.exact && match.prefix ? 1.5 : 0
  const phraseBoost = !match.exact && !match.prefix && match.lexical ? 0.55 : 0
  const pop = popularityBoost(data.popularity ?? legacyMetadata?.popularity)
  const votes = voteCountBoost(data.voteCount ?? legacyMetadata?.voteCount)
  const voteAverage = numberValue(
    data.tmdbVoteAverage ??
      data.voteAverage ??
      legacyMetadata?.tmdbVoteAverage ??
      legacyMetadata?.voteAverage
  )
  const finalScore =
    score * 0.18 +
    exactTitleBoost +
    exactOriginalTitleBoost +
    prefixTitleBoost +
    phraseBoost +
    pop * 0.25 +
    votes * 0.15
  const entity: SearchEntityV2 = {
    id: `title:${mediaType}:${tmdbId}`,
    entityType: mediaType,
    tmdbId,
    title,
    ...(yearValue(data.year ?? legacyMetadata?.year)
      ? { year: yearValue(data.year ?? legacyMetadata?.year) }
      : {}),
    ...(text(data.overview ?? legacyContent?.overview)
      ? { summary: text(data.overview ?? legacyContent?.overview) }
      : {}),
    ...(numberValue(data.popularity ?? legacyMetadata?.popularity) === undefined
      ? {}
      : {
          popularity: numberValue(data.popularity ?? legacyMetadata?.popularity),
        }),
    ...(numberValue(data.voteCount ?? legacyMetadata?.voteCount) === undefined
      ? {}
      : {
          voteCount: numberValue(data.voteCount ?? legacyMetadata?.voteCount),
        }),
    ...(voteAverage === undefined ? {} : { tmdbVoteAverage: voteAverage }),
    ...(text(data.posterPath ?? legacyMetadata?.posterPath)
      ? { imageUrl: text(data.posterPath ?? legacyMetadata?.posterPath) }
      : {}),
  }
  const debug: TitleSearchScoreDebug = {
    query,
    entityId: entity.id,
    upstashScore: score,
    exactTitleBoost,
    exactOriginalTitleBoost,
    prefixTitleBoost,
    popularityBoost: pop,
    voteCountBoost: votes,
    finalScore,
    source: sourceOf(input.source),
  }
  return {
    entity,
    upstashScore: score,
    exactTitleBoost,
    exactOriginalTitleBoost,
    prefixTitleBoost,
    popularityBoost: pop,
    voteCountBoost: votes,
    finalScore,
    semanticScore: score,
    lexicalScore:
      exactTitleBoost || exactOriginalTitleBoost
        ? 1
        : prefixTitleBoost
          ? 0.92
          : match.lexical
            ? 0.65
            : 0,
    exactMatch: Boolean(exactTitleBoost || exactOriginalTitleBoost),
    prefixMatch: Boolean(prefixTitleBoost),
    debug,
  }
}

export function scorePersonSearchHit(input: {
  readonly query: string
  readonly hit: UpstashSearchHit
  readonly source?: 'redis' | 'upstash' | 'tmdb' | 'both'
}) {
  const data = dataOf(input.hit)
  const tmdbId = numberValue(data.tmdbId)
  const name = text(data.name)
  if (!tmdbId || !name) return null
  const match = signals(normalizeSearchText(input.query), [name, ...values(data.aliases)])
  if (!match.lexical) return null
  const score = bounded(input.hit.score)
  const finalScore =
    score * 0.2 +
    (match.exact ? 1.2 : match.prefix ? 0.85 : 0.45) +
    popularityBoost(data.popularity) * 0.15
  return {
    entity: {
      id: `person:${tmdbId}`,
      entityType: 'person' as const,
      tmdbId,
      title: name,
      ...(text(data.knownForDepartment) ? { department: text(data.knownForDepartment) } : {}),
      ...(text(data.profilePath) ? { imageUrl: text(data.profilePath) } : {}),
    },
    confidence: bounded(finalScore / 2),
    exactMatch: match.exact,
    prefixMatch: match.prefix,
  }
}

export function scoreUserSearchHit(input: {
  readonly query: string
  readonly hit: UpstashSearchHit
  readonly source: 'redis' | 'upstash' | 'db' | 'both'
}) {
  const legacyMetadata = input.hit.metadata ?? {}
  const legacyContent = input.hit.content ?? {}
  const data = input.hit.data ?? { ...legacyMetadata, ...legacyContent }
  const userId = text(data.userId ?? legacyMetadata?.userId ?? data.id)
  const username = text(
    data.username ?? legacyContent?.username ?? legacyMetadata?.username
  ).replace(/^@+/u, '')
  const displayName = text(data.displayName ?? data.name ?? legacyContent?.name)
  if (!userId || !username) return null
  const query = normalizeUsernameSearchText(input.query)
  const normalizedUsername = normalizeUsernameSearchText(username)
  const normalizedDisplayName = normalizeSearchText(displayName)
  if (!isRelevantUserMatch(query, normalizedUsername, normalizedDisplayName)) return null
  const exactUsernameBoost = normalizedUsername === query ? 1.75 : 0
  const usernamePrefixBoost = !exactUsernameBoost && normalizedUsername.startsWith(query) ? 1.05 : 0
  const exactDisplayNameBoost = !exactUsernameBoost && normalizedDisplayName === query ? 0.6 : 0
  const score = bounded(input.hit.score)
  const finalScore = score * 0.12 + exactUsernameBoost + usernamePrefixBoost + exactDisplayNameBoost
  const debug: UserSearchScoreDebug = {
    query,
    entityId: `user:${userId}`,
    upstashScore: score,
    exactUsernameBoost,
    usernamePrefixBoost,
    exactDisplayNameBoost,
    finalScore,
    source: userSourceOf(input.source),
  }
  return {
    entity: {
      id: `user:${userId}`,
      entityType: 'user' as const,
      title: displayName || username,
      ...(text(data.avatarUrl ?? legacyMetadata?.avatarUrl)
        ? { imageUrl: text(data.avatarUrl ?? legacyMetadata?.avatarUrl) }
        : {}),
      route: `/${username}`,
    },
    upstashScore: score,
    exactUsernameBoost,
    usernamePrefixBoost,
    exactDisplayNameBoost,
    finalScore,
    semanticScore: score,
    lexicalScore: exactUsernameBoost ? 1 : usernamePrefixBoost ? 0.85 : 0.45,
    exactMatch: Boolean(exactUsernameBoost),
    prefixMatch: Boolean(usernamePrefixBoost),
    debug,
  }
}

export function isRelevantUserMatch(query: string, username: string, displayName?: string | null) {
  const normalizedQuery = normalizeUsernameSearchText(query)
  return (
    Boolean(normalizedQuery) &&
    (normalizeUsernameSearchText(username).includes(normalizedQuery) ||
      normalizeSearchText(displayName ?? '').includes(normalizedQuery))
  )
}
