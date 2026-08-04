import type { SearchIndexEntityType, SearchIndexMetadataV1 } from './types.ts'
import type { SearchIndexSchemaVersion } from './version.ts'

export interface IndexContentHashInput {
  readonly id: string
  readonly entityType: SearchIndexEntityType
  readonly searchableText: string
  readonly metadata: SearchIndexMetadataV1
  readonly indexVersion: SearchIndexSchemaVersion | number
  readonly contentHash?: string
}

const canonicalizeValue = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Index content must contain finite numbers')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => (item === undefined ? 'null' : canonicalizeValue(item)))
      .join(',')}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeValue(item)}`)
      .join(',')}}`
  }
  throw new TypeError(`Index content contains unsupported ${typeof value} data`)
}

export const canonicalizeIndexDocument = (input: IndexContentHashInput): string =>
  canonicalizeValue({
    id: input.id,
    entityType: input.entityType,
    searchableText: input.searchableText,
    metadata: input.metadata,
    indexVersion: input.indexVersion,
  })

export const createIndexContentHash = async (input: IndexContentHashInput): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalizeIndexDocument(input))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
