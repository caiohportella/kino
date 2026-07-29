import type { LocalizedImageFallbackReason, LocalizedImageLanguageTier } from './images.ts'
import { normalizeLocale, normalizeRegion } from './locale.ts'
import type { CacheScope } from './types.ts'

export const LOCALIZED_TITLE_BATCH_SCHEMA_VERSION = 1 as const
export const LOCALIZED_TITLE_BATCH_MAX_ITEMS = 100

export type LocalizedTitleBatchMediaType = 'movie' | 'tv'

export interface LocalizedTitleBatchItem {
  readonly tmdbId: number
  readonly type: LocalizedTitleBatchMediaType
}

export interface LocalizedTitleBatchInput {
  readonly schemaVersion: typeof LOCALIZED_TITLE_BATCH_SCHEMA_VERSION
  readonly items: readonly LocalizedTitleBatchItem[]
  readonly locale: string
  readonly region: string
}

export interface ResolvedLocalizedTitleSummary {
  readonly backdropPath: string | null
  readonly id: number
  readonly mediaType: LocalizedTitleBatchMediaType
  readonly posterPath: string | null
  readonly posterResolution: {
    readonly fallbackReason: LocalizedImageFallbackReason
    readonly languageTier: LocalizedImageLanguageTier
    readonly locale: string
    readonly source: 'tmdb-images'
  }
  readonly title: string
  readonly year: number | null
}

export interface LocalizedTitleBatchResponse {
  readonly schemaVersion: typeof LOCALIZED_TITLE_BATCH_SCHEMA_VERSION
  readonly errors: readonly LocalizedTitleBatchItem[]
  readonly missing: readonly LocalizedTitleBatchItem[]
  readonly summaries: readonly ResolvedLocalizedTitleSummary[]
}

export function normalizeLocalizedTitleBatchRequest(input: unknown): LocalizedTitleBatchInput {
  const record = objectRecord(input, 'Localized title batch request')
  if (record.schemaVersion !== LOCALIZED_TITLE_BATCH_SCHEMA_VERSION) {
    throw new Error('Unsupported localized title batch schema version.')
  }
  if (!Array.isArray(record.items) || record.items.length > LOCALIZED_TITLE_BATCH_MAX_ITEMS) {
    throw new Error('Localized title batch items are invalid.')
  }

  return {
    schemaVersion: LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
    items: record.items.map(normalizeItem),
    locale: normalizeLocale(stringValue(record.locale, 'locale')),
    region: normalizeRegion(stringValue(record.region, 'region')),
  }
}

export function normalizeLocalizedTitleBatchResponse(input: unknown): LocalizedTitleBatchResponse {
  const record = objectRecord(input, 'Localized title batch response')
  if (record.schemaVersion !== LOCALIZED_TITLE_BATCH_SCHEMA_VERSION) {
    throw new Error('Unsupported localized title batch response version.')
  }
  if (
    !Array.isArray(record.summaries) ||
    !Array.isArray(record.missing) ||
    !Array.isArray(record.errors)
  ) {
    throw new Error('Localized title batch response is malformed.')
  }

  return {
    schemaVersion: LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
    summaries: record.summaries.map(normalizeSummary),
    missing: record.missing.map(normalizeItem),
    errors: record.errors.map(normalizeItem),
  }
}

export function toLocalizedTitleSummaryCacheEntry(
  summary: ResolvedLocalizedTitleSummary,
  input: Pick<LocalizedTitleBatchInput, 'locale' | 'region'>
) {
  return {
    input: {
      id: summary.id,
      locale: input.locale,
      mediaType: summary.mediaType,
      region: input.region,
      scope: { kind: 'public' } satisfies CacheScope,
    },
    summary,
  }
}

function normalizeItem(input: unknown): LocalizedTitleBatchItem {
  const record = objectRecord(input, 'Localized title batch item')
  const tmdbId = record.tmdbId
  if (!Number.isSafeInteger(tmdbId) || (tmdbId as number) <= 0) {
    throw new Error('Localized title batch TMDB id is invalid.')
  }
  if (record.type !== 'movie' && record.type !== 'tv') {
    throw new Error('Localized title batch media type is invalid.')
  }
  return { tmdbId: tmdbId as number, type: record.type }
}

function normalizeSummary(input: unknown): ResolvedLocalizedTitleSummary {
  const record = objectRecord(input, 'Localized title summary')
  const posterResolution = objectRecord(record.posterResolution, 'Poster resolution')
  const mediaType = record.mediaType
  const id = record.id
  const year = record.year
  const languageTier = posterResolution.languageTier
  const fallbackReason = posterResolution.fallbackReason
  if (
    !Number.isSafeInteger(id) ||
    (id as number) <= 0 ||
    (mediaType !== 'movie' && mediaType !== 'tv') ||
    (year !== null && !Number.isSafeInteger(year)) ||
    !isNullableString(record.backdropPath) ||
    !isNullableString(record.posterPath) ||
    !isLanguageTier(languageTier) ||
    !isFallbackReason(fallbackReason) ||
    posterResolution.source !== 'tmdb-images'
  ) {
    throw new Error('Localized title summary is malformed.')
  }
  return {
    backdropPath: record.backdropPath as string | null,
    id: id as number,
    mediaType,
    posterPath: record.posterPath as string | null,
    posterResolution: {
      fallbackReason,
      languageTier,
      locale: normalizeLocale(stringValue(posterResolution.locale, 'poster locale')),
      source: 'tmdb-images',
    },
    title: stringValue(record.title, 'title'),
    year: year as number | null,
  }
}

function objectRecord(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error(`${label} is invalid.`)
  return input as Record<string, unknown>
}

function stringValue(input: unknown, label: string) {
  if (typeof input !== 'string' || !input.trim()) throw new Error(`${label} is invalid.`)
  return input
}

function isNullableString(input: unknown): input is string | null {
  return input === null || typeof input === 'string'
}

function isLanguageTier(input: unknown): input is LocalizedImageLanguageTier {
  return [
    'exact',
    'base',
    'fallback',
    'original',
    'neutral',
    'tmdb-default',
    'placeholder',
  ].includes(input as string)
}

function isFallbackReason(input: unknown): input is LocalizedImageFallbackReason {
  return (
    input === null ||
    [
      'base-language',
      'configured-fallback',
      'original-language',
      'language-neutral',
      'tmdb-default',
      'kino-placeholder',
    ].includes(input as string)
  )
}
