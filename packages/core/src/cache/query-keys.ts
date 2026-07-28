import { normalizeLocale, normalizeRegion } from '../localization/locale.ts'
import type { CacheScope } from '../localization/types.ts'
import type { MediaType } from '../types.ts'

export const CACHE_SCHEMA_VERSION = 'v1' as const

type PrimitiveFilter = boolean | number | string | null
export type CacheFilterValue =
  | PrimitiveFilter
  | readonly CacheFilterValue[]
  | { readonly [key: string]: CacheFilterValue }
export type CacheFilters = Readonly<Record<string, CacheFilterValue>>

interface ScopedInput {
  readonly scope: CacheScope
}

interface LocalizedScopedInput extends ScopedInput {
  readonly locale: string
  readonly region: string
}

export interface TitleQueryInput extends LocalizedScopedInput {
  readonly id: number
  readonly mediaType: MediaType
}

export interface TitleListQueryInput extends LocalizedScopedInput {
  readonly filters?: CacheFilters
  readonly list: string
  readonly page?: number
}

export interface SearchQueryInput extends LocalizedScopedInput {
  readonly filters?: CacheFilters
  readonly page?: number
  readonly query: string
}

export interface ProfileQueryInput extends ScopedInput {
  readonly profileId: string
}

export interface ProfileListQueryInput extends ProfileQueryInput {
  readonly filters?: CacheFilters
  readonly page?: number
  readonly resource: 'followers' | 'following' | 'reviews' | 'ratings'
}

export interface WatchlistQueryInput extends ScopedInput {
  readonly listId: string
}

export interface WatchlistItemsQueryInput extends WatchlistQueryInput {
  readonly filters?: CacheFilters
  readonly page?: number
}

export interface WatchlistListQueryInput extends ScopedInput {
  readonly filters?: CacheFilters
  readonly ownerId?: string
  readonly page?: number
}

const TITLE_ROOT = [CACHE_SCHEMA_VERSION, 'title'] as const
const SEARCH_ROOT = [CACHE_SCHEMA_VERSION, 'search'] as const
const PROFILE_ROOT = [CACHE_SCHEMA_VERSION, 'profile'] as const
const WATCHLIST_ROOT = [CACHE_SCHEMA_VERSION, 'watchlist'] as const

export const titleQueryKeys = {
  all: TITLE_ROOT,
  summaries: () => [...TITLE_ROOT, 'summary'] as const,
  summary: (input: TitleQueryInput) =>
    [...TITLE_ROOT, 'summary', ...localizedTitleSegments(input)] as const,
  detailsRoot: () => [...TITLE_ROOT, 'details'] as const,
  details: (input: TitleQueryInput) =>
    [...TITLE_ROOT, 'details', ...localizedTitleSegments(input)] as const,
  lists: () => [...TITLE_ROOT, 'list'] as const,
  list: (input: TitleListQueryInput) =>
    [
      ...TITLE_ROOT,
      'list',
      requireIdentifier(input.list, 'list'),
      ...localizedContextSegments(input),
      normalizePage(input.page),
      normalizeFilters(input.filters),
    ] as const,
}

export const searchQueryKeys = {
  all: SEARCH_ROOT,
  resultsRoot: () => [...SEARCH_ROOT, 'results'] as const,
  results: (input: SearchQueryInput) =>
    [
      ...SEARCH_ROOT,
      'results',
      normalizeQuery(input.query),
      ...localizedContextSegments(input),
      normalizePage(input.page),
      normalizeFilters(input.filters),
    ] as const,
}

export const profileQueryKeys = {
  all: PROFILE_ROOT,
  detailsRoot: () => [...PROFILE_ROOT, 'details'] as const,
  details: (input: ProfileQueryInput) =>
    [
      ...PROFILE_ROOT,
      'details',
      requireIdentifier(input.profileId, 'profile id'),
      ...scopeSegments(input.scope),
    ] as const,
  lists: () => [...PROFILE_ROOT, 'list'] as const,
  list: (input: ProfileListQueryInput) =>
    [
      ...PROFILE_ROOT,
      'list',
      input.resource,
      requireIdentifier(input.profileId, 'profile id'),
      ...scopeSegments(input.scope),
      normalizePage(input.page),
      normalizeFilters(input.filters),
    ] as const,
}

export const watchlistQueryKeys = {
  all: WATCHLIST_ROOT,
  detailsRoot: () => [...WATCHLIST_ROOT, 'details'] as const,
  details: (input: WatchlistQueryInput) =>
    [
      ...WATCHLIST_ROOT,
      'details',
      requireIdentifier(input.listId, 'watchlist id'),
      ...scopeSegments(input.scope),
    ] as const,
  itemsRoot: () => [...WATCHLIST_ROOT, 'items'] as const,
  items: (input: WatchlistItemsQueryInput) =>
    [
      ...WATCHLIST_ROOT,
      'items',
      requireIdentifier(input.listId, 'watchlist id'),
      ...scopeSegments(input.scope),
      normalizePage(input.page),
      ...(input.filters ? [normalizeFilters(input.filters)] : []),
    ] as const,
  lists: () => [...WATCHLIST_ROOT, 'list'] as const,
  list: (input: WatchlistListQueryInput) =>
    [
      ...WATCHLIST_ROOT,
      'list',
      input.ownerId ? requireIdentifier(input.ownerId, 'owner id') : 'viewer',
      ...scopeSegments(input.scope),
      normalizePage(input.page),
      normalizeFilters(input.filters),
    ] as const,
}

function localizedTitleSegments(input: TitleQueryInput) {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) {
    throw new TypeError('Title id must be a positive integer.')
  }

  return [input.mediaType, input.id, ...localizedContextSegments(input)] as const
}

function localizedContextSegments(input: LocalizedScopedInput) {
  return [
    normalizeLocale(input.locale),
    normalizeRegion(input.region),
    ...scopeSegments(input.scope),
  ] as const
}

function scopeSegments(scope: CacheScope) {
  if (scope.kind === 'public') return ['public'] as const
  return ['authenticated', requireIdentifier(scope.userId, 'authenticated user id')] as const
}

function normalizeQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new TypeError('Search query cannot be empty.')
  return normalized
}

function normalizePage(page = 1) {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new TypeError('Page must be a positive integer.')
  }
  return page
}

function requireIdentifier(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) throw new TypeError(`${label} cannot be empty.`)
  return normalized
}

function normalizeFilters(filters: CacheFilters | undefined): CacheFilters {
  if (!filters) return {}
  return normalizeFilterRecord(filters)
}

function normalizeFilterRecord(filters: Readonly<Record<string, CacheFilterValue>>): CacheFilters {
  return Object.fromEntries(
    Object.keys(filters)
      .sort()
      .map((key) => [key, normalizeFilterValue(filters[key] as CacheFilterValue)])
  )
}

function normalizeFilterValue(value: CacheFilterValue): CacheFilterValue {
  if (isFilterArray(value)) return value.map(normalizeFilterValue)
  if (value !== null && typeof value === 'object') return normalizeFilterRecord(value)
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value
  }
  throw new TypeError('Cache filters must contain only serializable finite values.')
}

function isFilterArray(value: CacheFilterValue): value is readonly CacheFilterValue[] {
  return Array.isArray(value)
}
