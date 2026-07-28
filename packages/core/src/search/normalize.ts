import {
  type LexicalCandidate,
  type NormalizedSearchQuery,
  type PersonCandidate,
  SEARCH_SCHEMA_VERSION,
  type SearchEntity,
  type SearchMediaType,
  type SearchProviderCandidate,
  type SearchRequestV1,
  type SemanticCandidate,
  UnsupportedSearchVersion,
} from './types.ts'

const RELEASE_YEAR_MINIMUM = 1870
const RELEASE_YEAR_MAXIMUM = 2100
const MEDIA_TYPES = new Set<SearchMediaType>(['movie', 'series'])
const ENTITY_TYPES = new Set(['movie', 'series', 'person', 'user'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedScore(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : undefined
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeLocale(value: unknown): string | undefined {
  const locale = optionalTrimmedString(value)
  if (!locale) return undefined
  try {
    return Intl.getCanonicalLocales(locale)[0]
  } catch {
    return undefined
  }
}

function normalizeEntity(value: unknown): SearchEntity | null {
  if (!isRecord(value)) return null
  const id = optionalTrimmedString(value.id)
  const title = optionalTrimmedString(value.title)
  const entityType = value.entityType
  if (!id || !title || typeof entityType !== 'string' || !ENTITY_TYPES.has(entityType)) return null

  const tmdbId = positiveInteger(value.tmdbId)
  const year = positiveInteger(value.year)
  const locale = normalizeLocale(value.locale)
  const route = optionalTrimmedString(value.route)
  const summary = optionalTrimmedString(value.summary)
  const imageUrl = optionalTrimmedString(value.imageUrl)
  const popularity = optionalFiniteNumber(value.popularity)
  const voteCount = optionalFiniteNumber(value.voteCount)

  return {
    id,
    entityType: entityType as SearchEntity['entityType'],
    title,
    ...(tmdbId === undefined ? {} : { tmdbId }),
    ...(year === undefined ? {} : { year }),
    ...(locale === undefined ? {} : { locale }),
    ...(route === undefined ? {} : { route }),
    ...(summary === undefined ? {} : { summary }),
    ...(imageUrl === undefined ? {} : { imageUrl }),
    ...(popularity === undefined ? {} : { popularity }),
    ...(voteCount === undefined ? {} : { voteCount }),
  }
}

export function normalizeSearchQuery(query: string): NormalizedSearchQuery {
  const original = query.trim().replace(/\s+/gu, ' ')
  const folded = original
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
  const tokens = folded.length === 0 ? [] : folded.split(' ')
  const terminalYear = tokens.at(-1)
  const parsedYear =
    terminalYear && /^\d{4}$/u.test(terminalYear) ? Number(terminalYear) : undefined
  const year =
    parsedYear !== undefined &&
    parsedYear >= RELEASE_YEAR_MINIMUM &&
    parsedYear <= RELEASE_YEAR_MAXIMUM
      ? parsedYear
      : undefined

  return {
    original,
    folded,
    tokens,
    ...(year === undefined ? {} : { year }),
  }
}

export function normalizeSearchRequestV1(input: unknown): SearchRequestV1 {
  if (!isRecord(input) || input.schemaVersion !== SEARCH_SCHEMA_VERSION) {
    throw new UnsupportedSearchVersion(isRecord(input) ? input.schemaVersion : undefined)
  }
  if (typeof input.query !== 'string') throw new TypeError('Search query must be a string')

  const query = input.query.trim().replace(/\s+/gu, ' ')
  const locale = normalizeLocale(input.locale)
  const region = optionalTrimmedString(input.region)?.toUpperCase()
  const page = positiveInteger(input.page)
  const limit = positiveInteger(input.limit)
  const mediaTypes = Array.isArray(input.mediaTypes)
    ? [
        ...new Set(
          input.mediaTypes.filter((value): value is SearchMediaType => MEDIA_TYPES.has(value))
        ),
      ]
    : undefined

  return {
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query,
    ...(locale === undefined ? {} : { locale }),
    ...(region === undefined ? {} : { region }),
    ...(mediaTypes === undefined ? {} : { mediaTypes }),
    ...(page === undefined ? {} : { page }),
    ...(limit === undefined ? {} : { limit }),
  }
}

export function normalizeProviderCandidate(input: unknown): SearchProviderCandidate | null {
  if (!isRecord(input)) return null
  const entity = normalizeEntity(input.entity)
  const localeRelevance = boundedScore(input.localeRelevance)
  if (!entity) return null

  if (input.source === 'semantic') {
    const semanticScore = boundedScore(input.semanticScore)
    if (semanticScore === undefined) return null
    return {
      source: 'semantic',
      entity,
      semanticScore,
      ...(localeRelevance === undefined ? {} : { localeRelevance }),
    } satisfies SemanticCandidate
  }

  if (input.source === 'lexical') {
    const lexicalScore = boundedScore(input.lexicalScore)
    if (lexicalScore === undefined) return null
    return {
      source: 'lexical',
      entity,
      lexicalScore,
      ...(input.exactMatch === true ? { exactMatch: true } : {}),
      ...(input.prefixMatch === true ? { prefixMatch: true } : {}),
      ...(localeRelevance === undefined ? {} : { localeRelevance }),
    } satisfies LexicalCandidate
  }

  if (input.source === 'person' && entity.entityType === 'person') {
    const confidence = boundedScore(input.confidence)
    if (confidence === undefined) return null
    return {
      source: 'person',
      entity: { ...entity, entityType: 'person' },
      confidence,
      ...(localeRelevance === undefined ? {} : { localeRelevance }),
    } satisfies PersonCandidate
  }

  return null
}

export function isSearchResponseV1(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.schemaVersion === SEARCH_SCHEMA_VERSION &&
    Array.isArray(value.results) &&
    Array.isArray(value.groups)
  )
}
