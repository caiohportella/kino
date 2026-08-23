import { normalizeLocale, normalizeRegion } from './locale.ts'
import {
  LOCALIZED_TITLE_BATCH_MAX_ITEMS,
  type LocalizedTitleBatchItem,
} from './localized-title-batch.ts'

export const LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION = 1 as const

export type LocalizedTitleNameBatchItem = LocalizedTitleBatchItem

export interface LocalizedTitleNameBatchInput {
  readonly schemaVersion: typeof LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION
  readonly items: readonly LocalizedTitleNameBatchItem[]
  readonly locale: string
  readonly region: string
}

export interface ResolvedLocalizedTitleName {
  readonly id: number
  readonly mediaType: 'movie' | 'tv'
  readonly title: string
}

export interface LocalizedTitleNameBatchResponse {
  readonly schemaVersion: typeof LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION
  readonly names: readonly ResolvedLocalizedTitleName[]
  readonly missing: readonly LocalizedTitleNameBatchItem[]
  readonly errors: readonly LocalizedTitleNameBatchItem[]
}

export function normalizeLocalizedTitleNameBatchRequest(
  input: unknown
): LocalizedTitleNameBatchInput {
  const record = objectRecord(input, 'Localized title name batch request')

  if (record.schemaVersion !== LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION) {
    throw new Error('Unsupported localized title name batch schema version.')
  }

  if (!Array.isArray(record.items) || record.items.length > LOCALIZED_TITLE_BATCH_MAX_ITEMS) {
    throw new Error('Localized title name batch items are invalid.')
  }

  return {
    schemaVersion: LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
    items: record.items.map(normalizeItem),
    locale: normalizeLocale(stringValue(record.locale, 'locale')),
    region: normalizeRegion(stringValue(record.region, 'region')),
  }
}

export function normalizeLocalizedTitleNameBatchResponse(
  input: unknown
): LocalizedTitleNameBatchResponse {
  const record = objectRecord(input, 'Localized title name batch response')

  if (record.schemaVersion !== LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION) {
    throw new Error('Unsupported localized title name batch response version.')
  }

  if (
    !Array.isArray(record.names) ||
    !Array.isArray(record.missing) ||
    !Array.isArray(record.errors)
  ) {
    throw new Error('Localized title name batch response is malformed.')
  }

  return {
    schemaVersion: LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
    names: record.names.map(normalizeName),
    missing: record.missing.map(normalizeItem),
    errors: record.errors.map(normalizeItem),
  }
}

function normalizeItem(input: unknown): LocalizedTitleNameBatchItem {
  const record = objectRecord(input, 'Localized title name batch item')
  const tmdbId = record.tmdbId

  if (!Number.isSafeInteger(tmdbId) || (tmdbId as number) <= 0) {
    throw new Error('Localized title name batch TMDB id is invalid.')
  }

  if (record.type !== 'movie' && record.type !== 'tv') {
    throw new Error('Localized title name batch media type is invalid.')
  }

  return {
    tmdbId: tmdbId as number,
    type: record.type,
  }
}

function normalizeName(input: unknown): ResolvedLocalizedTitleName {
  const record = objectRecord(input, 'Localized title name')
  const id = record.id
  const mediaType = record.mediaType

  if (
    !Number.isSafeInteger(id) ||
    (id as number) <= 0 ||
    (mediaType !== 'movie' && mediaType !== 'tv')
  ) {
    throw new Error('Localized title name is malformed.')
  }

  return {
    id: id as number,
    mediaType,
    title: stringValue(record.title, 'title'),
  }
}

function objectRecord(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} is invalid.`)
  }

  return input as Record<string, unknown>
}

function stringValue(input: unknown, label: string) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error(`${label} is invalid.`)
  }

  return input
}
