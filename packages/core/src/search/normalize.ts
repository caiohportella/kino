import {
  type CreditSearchScore,
  type LexicalCandidate,
  type NormalizedSearchQuery,
  type PersonCandidate,
  SEARCH_SCHEMA_VERSION,
  SEARCH_SCHEMA_VERSION_V1,
  SEARCH_SCHEMA_VERSION_V2,
  type SearchEntity,
  type SearchEntityV2,
  type SearchMediaType,
  type SearchProviderCandidate,
  type SearchRequest,
  type SearchRequestV1,
  type SearchRequestV2,
  type SearchResponse,
  type SemanticCandidate,
  UnsupportedSearchVersion,
} from './types.ts'

const RELEASE_YEAR_MINIMUM = 1870
const RELEASE_YEAR_MAXIMUM = 2100
const MEDIA_TYPES = new Set<SearchMediaType>(['movie', 'series'])
const ENTITY_TYPES = new Set(['movie', 'series', 'person', 'user'])
const RELATIONSHIP_ROLES = new Set(['acting', 'directing', 'creating', 'writing'])
const RESULT_GROUP_TYPES = new Set(['people', 'movies', 'series', 'users'])
const FALLBACK_TYPES = new Set(['none', 'supplemented', 'provider_unavailable'])
const GROUP_ENTITY_TYPES: Readonly<Record<string, string>> = {
  people: 'person',
  movies: 'movie',
  series: 'series',
  users: 'user',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedScore(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : undefined
}

function requiredBoundedScore(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`)
  }
  return Math.max(0, Math.min(1, value))
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

function normalizeEntityV2(value: unknown): SearchEntityV2 | null {
  const entity = normalizeEntity(value)
  if (!entity || !isRecord(value)) return null
  const tmdbVoteAverage = value.tmdbVoteAverage
  const kinoAverageRating = value.kinoAverageRating
  if (
    (tmdbVoteAverage !== undefined &&
      tmdbVoteAverage !== null &&
      (typeof tmdbVoteAverage !== 'number' || !Number.isFinite(tmdbVoteAverage))) ||
    (kinoAverageRating !== undefined &&
      kinoAverageRating !== null &&
      (typeof kinoAverageRating !== 'number' || !Number.isFinite(kinoAverageRating)))
  ) {
    return null
  }

  return {
    ...entity,
    ...(tmdbVoteAverage === undefined ? {} : { tmdbVoteAverage }),
    ...(kinoAverageRating === undefined ? {} : { kinoAverageRating }),
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
  return normalizeSearchRequestWithVersion(input, SEARCH_SCHEMA_VERSION_V1)
}

export function normalizeSearchRequestV2(input: unknown): SearchRequestV2 {
  return normalizeSearchRequestWithVersion(input, SEARCH_SCHEMA_VERSION_V2)
}

function normalizeSearchRequestWithVersion<TVersion extends 1 | 2>(
  input: unknown,
  schemaVersion: TVersion
): TVersion extends 1 ? SearchRequestV1 : SearchRequestV2 {
  if (!isRecord(input) || input.schemaVersion !== schemaVersion) {
    throw new UnsupportedSearchVersion(
      isRecord(input) ? input.schemaVersion : undefined,
      schemaVersion,
      schemaVersion
    )
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

  if (schemaVersion === SEARCH_SCHEMA_VERSION_V2) {
    if (input.locale !== undefined && locale === undefined) {
      throw new TypeError('Search locale must be a valid locale')
    }
    if (input.region !== undefined && region === undefined) {
      throw new TypeError('Search region must be a non-empty string')
    }
    if (input.page !== undefined && page === undefined) {
      throw new TypeError('Search page must be a positive integer')
    }
    if (input.limit !== undefined && limit === undefined) {
      throw new TypeError('Search limit must be a positive integer')
    }
    if (
      input.mediaTypes !== undefined &&
      (!Array.isArray(input.mediaTypes) ||
        input.mediaTypes.some((value) => !MEDIA_TYPES.has(value as SearchMediaType)))
    ) {
      throw new TypeError('Search media types must contain only movie or series')
    }
  }

  return {
    schemaVersion,
    query,
    ...(locale === undefined ? {} : { locale }),
    ...(region === undefined ? {} : { region }),
    ...(mediaTypes === undefined ? {} : { mediaTypes }),
    ...(page === undefined ? {} : { page }),
    ...(limit === undefined ? {} : { limit }),
  } as TVersion extends 1 ? SearchRequestV1 : SearchRequestV2
}

export function normalizeSearchRequest(input: unknown): SearchRequest {
  if (!isRecord(input)) throw new UnsupportedSearchVersion(undefined)
  if (input.schemaVersion === SEARCH_SCHEMA_VERSION_V1) return normalizeSearchRequestV1(input)
  if (input.schemaVersion === SEARCH_SCHEMA_VERSION_V2) return normalizeSearchRequestV2(input)
  throw new UnsupportedSearchVersion(input.schemaVersion)
}

export function normalizeCreditSearchScore(input: unknown): CreditSearchScore {
  if (!isRecord(input)) throw new TypeError('Search score must be an object')
  return {
    relationshipScore: requiredBoundedScore(input.relationshipScore, 'relationshipScore'),
    semanticScore: requiredBoundedScore(input.semanticScore, 'semanticScore'),
    popularityScore: requiredBoundedScore(input.popularityScore, 'popularityScore'),
    voteConfidenceScore:
      input.voteConfidenceScore === undefined
        ? 0.5
        : requiredBoundedScore(input.voteConfidenceScore, 'voteConfidenceScore'),
    castOrderScore: requiredBoundedScore(input.castOrderScore, 'castOrderScore'),
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
  const isPositiveInteger = (input: unknown) =>
    typeof input === 'number' && Number.isInteger(input) && input > 0
  const isNonNegativeInteger = (input: unknown) =>
    typeof input === 'number' && Number.isInteger(input) && input >= 0
  const isOptionalString = (input: unknown) =>
    input === undefined || (typeof input === 'string' && input.length > 0)
  const isEntity = (input: unknown) =>
    isRecord(input) &&
    typeof input.id === 'string' &&
    input.id.length > 0 &&
    typeof input.title === 'string' &&
    input.title.length > 0 &&
    typeof input.entityType === 'string' &&
    ENTITY_TYPES.has(input.entityType) &&
    (input.tmdbId === undefined || isPositiveInteger(input.tmdbId)) &&
    (input.year === undefined || isPositiveInteger(input.year)) &&
    isOptionalString(input.locale) &&
    isOptionalString(input.route) &&
    isOptionalString(input.summary) &&
    isOptionalString(input.imageUrl) &&
    (input.popularity === undefined ||
      (typeof input.popularity === 'number' && Number.isFinite(input.popularity))) &&
    (input.voteCount === undefined ||
      (typeof input.voteCount === 'number' && Number.isFinite(input.voteCount)))
  const isResult = (input: unknown) =>
    isRecord(input) &&
    isEntity(input.entity) &&
    typeof input.score === 'number' &&
    Number.isFinite(input.score) &&
    input.score >= 0 &&
    Array.isArray(input.sources) &&
    input.sources.length > 0 &&
    input.sources.every((source) => typeof source === 'string' && source.length > 0) &&
    (input.relationship === undefined ||
      (isRecord(input.relationship) &&
        typeof input.relationship.personId === 'string' &&
        input.relationship.personId.length > 0 &&
        typeof input.relationship.role === 'string' &&
        RELATIONSHIP_ROLES.has(input.relationship.role)))
  const isQuery =
    isRecord(value) &&
    isRecord(value.query) &&
    typeof value.query.original === 'string' &&
    typeof value.query.folded === 'string' &&
    Array.isArray(value.query.tokens) &&
    value.query.tokens.every((token) => typeof token === 'string') &&
    (value.query.year === undefined || isPositiveInteger(value.query.year))
  const hasValidGroups =
    isRecord(value) &&
    Array.isArray(value.groups) &&
    value.groups.every(
      (group) =>
        isRecord(group) &&
        typeof group.type === 'string' &&
        RESULT_GROUP_TYPES.has(group.type) &&
        Array.isArray(group.results) &&
        group.results.every(
          (result) =>
            isResult(result) &&
            isRecord(result) &&
            isRecord(result.entity) &&
            result.entity.entityType === GROUP_ENTITY_TYPES[group.type as string]
        )
    )

  return (
    isRecord(value) &&
    value.schemaVersion === SEARCH_SCHEMA_VERSION &&
    isQuery &&
    Array.isArray(value.results) &&
    value.results.every(isResult) &&
    hasValidGroups &&
    isNonNegativeInteger(value.total) &&
    Number(value.total) >= value.results.length &&
    isPositiveInteger(value.page) &&
    isPositiveInteger(value.limit) &&
    (value.nextPage === undefined || isPositiveInteger(value.nextPage)) &&
    (value.fallback === undefined ||
      (typeof value.fallback === 'string' && FALLBACK_TYPES.has(value.fallback)))
  )
}

function isSearchEntityV2(value: unknown): boolean {
  const entity = normalizeEntityV2(value)
  return entity !== null
}

function isCreditSearchScore(value: unknown): boolean {
  if (!isRecord(value)) return false
  return [
    value.relationshipScore,
    value.semanticScore,
    value.popularityScore,
    value.voteConfidenceScore,
    value.castOrderScore,
  ].every(
    (score) =>
      typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1
  )
}

function isSearchResultV2(value: unknown): boolean {
  return (
    isRecord(value) &&
    isSearchEntityV2(value.entity) &&
    isCreditSearchScore(value.score) &&
    Array.isArray(value.sources) &&
    value.sources.length > 0 &&
    value.sources.every((source) => typeof source === 'string' && source.length > 0) &&
    (value.relationship === undefined ||
      (isRecord(value.relationship) &&
        typeof value.relationship.personId === 'string' &&
        value.relationship.personId.length > 0 &&
        typeof value.relationship.role === 'string' &&
        RELATIONSHIP_ROLES.has(value.relationship.role)))
  )
}

export function isSearchResponseV2(value: unknown): boolean {
  const isPositiveInteger = (input: unknown) =>
    typeof input === 'number' && Number.isInteger(input) && input > 0
  const isNonNegativeInteger = (input: unknown) =>
    typeof input === 'number' && Number.isInteger(input) && input >= 0
  const isQuery =
    isRecord(value) &&
    isRecord(value.query) &&
    typeof value.query.original === 'string' &&
    typeof value.query.folded === 'string' &&
    Array.isArray(value.query.tokens) &&
    value.query.tokens.every((token) => typeof token === 'string') &&
    (value.query.year === undefined || isPositiveInteger(value.query.year))
  const hasValidGroups =
    isRecord(value) &&
    Array.isArray(value.groups) &&
    value.groups.every(
      (group) =>
        isRecord(group) &&
        typeof group.type === 'string' &&
        RESULT_GROUP_TYPES.has(group.type) &&
        Array.isArray(group.results) &&
        group.results.every(
          (result) =>
            isSearchResultV2(result) &&
            isRecord(result) &&
            isRecord(result.entity) &&
            result.entity.entityType === GROUP_ENTITY_TYPES[group.type as string]
        )
    )

  return (
    isRecord(value) &&
    value.schemaVersion === SEARCH_SCHEMA_VERSION_V2 &&
    isQuery &&
    Array.isArray(value.results) &&
    value.results.every(isSearchResultV2) &&
    hasValidGroups &&
    isNonNegativeInteger(value.total) &&
    Number(value.total) >= value.results.length &&
    isPositiveInteger(value.page) &&
    isPositiveInteger(value.limit) &&
    (value.nextPage === undefined || isPositiveInteger(value.nextPage)) &&
    (value.fallback === undefined ||
      (typeof value.fallback === 'string' && FALLBACK_TYPES.has(value.fallback)))
  )
}

export function isSearchResponse(value: unknown): value is SearchResponse {
  return isSearchResponseV1(value) || isSearchResponseV2(value)
}
