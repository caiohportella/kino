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

export interface CanonicalTitleQueryInput {
  readonly id: number
  readonly locale: string
  readonly mediaType: MediaType
  readonly region: string
  readonly scope: CacheScope
}

export interface TitleQueryDescriptor {
  readonly context: CanonicalTitleQueryInput
  readonly details: readonly [
    typeof CACHE_SCHEMA_VERSION,
    'title',
    'details',
    MediaType,
    number,
    string,
    string,
    ...(readonly string[]),
  ]
  readonly summary: readonly [
    typeof CACHE_SCHEMA_VERSION,
    'title',
    'summary',
    MediaType,
    number,
    string,
    string,
    ...(readonly string[]),
  ]
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

export interface ProfileIdentityQueryInput {
  readonly profileId: string
  readonly visibilityScope: CacheScope
}

export interface ProfileRelationshipQueryInput {
  readonly profileId: string
  readonly viewerId: string
}

export interface ProfileSectionQueryInput extends ProfileIdentityQueryInput {
  readonly filters?: CacheFilters
  readonly page?: number
}

export interface ProfileAvailabilityQueryInput extends ProfileSectionQueryInput {
  readonly locale: string
  readonly mediaType: MediaType
  readonly region: string
  readonly seasonNumber: number
  readonly titleId: number
}

type ProfileSectionInvalidationDescriptor = {
  readonly profileId: string
  readonly visibilityScope: CacheScope
}

export type ProfileInvalidationDescriptor =
  | ({ readonly kind: 'identity' } & ProfileIdentityQueryInput)
  | ({ readonly kind: 'relationship' } & ProfileRelationshipQueryInput)
  | ({ readonly kind: 'watched-movies' } & ProfileSectionInvalidationDescriptor)
  | ({ readonly kind: 'watched-series' } & ProfileSectionInvalidationDescriptor)
  | ({ readonly kind: 'statistics' } & ProfileIdentityQueryInput)
  | ({ readonly kind: 'watchlists' } & ProfileSectionInvalidationDescriptor)
  | ({ readonly kind: 'reviews' } & ProfileSectionInvalidationDescriptor)
  | ({ readonly kind: 'ratings' } & ProfileSectionInvalidationDescriptor)

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
  canonical: (input: TitleQueryInput) => createTitleQueryDescriptor(input),
  summaries: () => [...TITLE_ROOT, 'summary'] as const,
  summary: (input: TitleQueryInput) => createTitleQueryDescriptor(input).summary,
  detailsRoot: () => [...TITLE_ROOT, 'details'] as const,
  details: (input: TitleQueryInput) => createTitleQueryDescriptor(input).details,
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
  usernameResolutions: () => [...PROFILE_ROOT, 'username-resolution'] as const,
  usernameResolution: (username: string) =>
    [...PROFILE_ROOT, 'username-resolution', normalizeUsername(username)] as const,
  identities: () => [...PROFILE_ROOT, 'identity'] as const,
  identity: (input: ProfileIdentityQueryInput) =>
    [
      ...PROFILE_ROOT,
      'identity',
      requireIdentifier(input.profileId, 'profile id'),
      ...scopeSegments(input.visibilityScope),
    ] as const,
  relationships: () => [...PROFILE_ROOT, 'relationship'] as const,
  relationship: (input: ProfileRelationshipQueryInput) =>
    [
      ...PROFILE_ROOT,
      'relationship',
      requireIdentifier(input.profileId, 'profile id'),
      requireIdentifier(input.viewerId, 'viewer id'),
    ] as const,
  watchedMovies: (input: ProfileSectionQueryInput) => profileSectionKey('watched-movies', input),
  watchedMoviesRoot: (input: ProfileIdentityQueryInput) =>
    profileSectionRootKey('watched-movies', input),
  watchedSeries: (input: ProfileSectionQueryInput) => profileSectionKey('watched-series', input),
  watchedSeriesRoot: (input: ProfileIdentityQueryInput) =>
    profileSectionRootKey('watched-series', input),
  statistics: (input: ProfileIdentityQueryInput) =>
    [
      ...PROFILE_ROOT,
      'statistics',
      requireIdentifier(input.profileId, 'profile id'),
      ...scopeSegments(input.visibilityScope),
    ] as const,
  watchlists: (input: ProfileSectionQueryInput) => profileSectionKey('watchlists', input),
  watchlistsRoot: (input: ProfileIdentityQueryInput) => profileSectionRootKey('watchlists', input),
  reviews: (input: ProfileSectionQueryInput) => profileSectionKey('reviews', input),
  reviewsRoot: (input: ProfileIdentityQueryInput) => profileSectionRootKey('reviews', input),
  ratings: (input: ProfileSectionQueryInput) => profileSectionKey('ratings', input),
  ratingsRoot: (input: ProfileIdentityQueryInput) => profileSectionRootKey('ratings', input),
  availability: (input: ProfileAvailabilityQueryInput) =>
    [
      ...PROFILE_ROOT,
      'availability',
      requireIdentifier(input.profileId, 'profile id'),
      input.mediaType,
      requirePositiveInteger(input.titleId, 'title id'),
      requirePositiveInteger(input.seasonNumber, 'season number'),
      normalizeLocale(input.locale),
      normalizeRegion(input.region),
      ...scopeSegments(input.visibilityScope),
      normalizePage(input.page),
      normalizeFilters(input.filters),
    ] as const,
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

function profileSectionKey(section: string, input: ProfileSectionQueryInput) {
  return [
    ...profileSectionRootKey(section, input),
    normalizePage(input.page),
    normalizeFilters(input.filters),
  ] as const
}

function profileSectionRootKey(section: string, input: ProfileIdentityQueryInput) {
  return [
    ...PROFILE_ROOT,
    section,
    requireIdentifier(input.profileId, 'profile id'),
    ...scopeSegments(input.visibilityScope),
  ] as const
}

export function createProfileInvalidationDescriptor<
  Kind extends ProfileInvalidationDescriptor['kind'],
>(
  kind: Kind,
  input: Omit<Extract<ProfileInvalidationDescriptor, { kind: Kind }>, 'kind'>
): Extract<ProfileInvalidationDescriptor, { kind: Kind }> {
  return { kind, ...input } as Extract<ProfileInvalidationDescriptor, { kind: Kind }>
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

function createTitleQueryDescriptor(input: TitleQueryInput): TitleQueryDescriptor {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) {
    throw new TypeError('Title id must be a positive integer.')
  }

  const context: CanonicalTitleQueryInput = {
    id: input.id,
    locale: normalizeLocale(input.locale),
    mediaType: input.mediaType,
    region: normalizeRegion(input.region),
    scope: normalizeScope(input.scope),
  }
  const scope =
    context.scope.kind === 'public'
      ? (['public'] as const)
      : (['authenticated', context.scope.userId] as const)

  return {
    context,
    details: [
      ...TITLE_ROOT,
      'details',
      context.mediaType,
      context.id,
      context.locale,
      context.region,
      ...scope,
    ],
    summary: [
      ...TITLE_ROOT,
      'summary',
      context.mediaType,
      context.id,
      context.locale,
      context.region,
      ...scope,
    ],
  }
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

function normalizeScope(scope: CacheScope): CacheScope {
  if (scope.kind === 'public') return { kind: 'public' }
  return {
    kind: 'authenticated',
    userId: requireIdentifier(scope.userId, 'authenticated user id'),
  }
}

function normalizeQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new TypeError('Search query cannot be empty.')
  return normalized
}

function normalizeUsername(username: string) {
  const normalized = requireIdentifier(username, 'username').toLowerCase()
  return normalized
}

function normalizePage(page = 1) {
  return requirePositiveInteger(page, 'page')
}

function requirePositiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer.`)
  }
  return value
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
