import type { PersonCredit, SearchMediaType, SearchRelationshipRole } from '@kino/core/search'

export const PERSON_RELATIONSHIP_SCHEMA_VERSION = 1 as const
export const PERSON_RELATIONSHIP_STALE_TIME_MS = 7 * 24 * 60 * 60 * 1_000
export const PERSON_RELATIONSHIP_MAX_ALIASES = 32
export const PERSON_RELATIONSHIP_MAX_CREDITS = 500
export const PERSON_RELATIONSHIP_MAX_BYTES = 128 * 1_024

export interface PersonRelationshipRecord {
  readonly schemaVersion: typeof PERSON_RELATIONSHIP_SCHEMA_VERSION
  readonly personId: number
  readonly aliases: readonly string[]
  readonly knownForDepartment: string | null
  readonly movieCredits: readonly PersonCredit[]
  readonly tvCredits: readonly PersonCredit[]
  readonly complete: boolean
  readonly updatedAt: string
}

export type PersonRelationshipRecordEvaluation =
  | { readonly state: 'missing' }
  | { readonly state: 'incompatible' }
  | { readonly state: 'corrupt' }
  | { readonly state: 'oversized' }
  | {
      readonly state: 'fresh_complete' | 'stale_complete' | 'incomplete'
      readonly record: PersonRelationshipRecord
    }

const mediaTypes = new Set<SearchMediaType>(['movie', 'series'])
const roles = new Set<SearchRelationshipRole>(['acting', 'directing', 'creating', 'writing'])
const appearances = new Set(['standard', 'self', 'archive'])

function isCredit(value: unknown): value is PersonCredit {
  if (!value || typeof value !== 'object') return false
  const credit = value as Record<string, unknown>
  const entity = credit.entity
  if (!entity || typeof entity !== 'object') return false
  const candidate = entity as Record<string, unknown>

  return (
    mediaTypes.has(candidate.entityType as SearchMediaType) &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    Number.isInteger(candidate.tmdbId) &&
    (candidate.tmdbId as number) > 0 &&
    typeof candidate.title === 'string' &&
    candidate.title.length > 0 &&
    roles.has(credit.role as SearchRelationshipRole) &&
    (credit.castOrder === undefined ||
      (Number.isInteger(credit.castOrder) && (credit.castOrder as number) >= 0)) &&
    (credit.appearance === undefined || appearances.has(credit.appearance as string))
  )
}

function serializedSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export function evaluateRelationshipRecord(
  value: unknown,
  options: { readonly now?: number; readonly staleTimeMs?: number } = {}
): PersonRelationshipRecordEvaluation {
  if (value === null || value === undefined) return { state: 'missing' }
  if (!value || typeof value !== 'object') return { state: 'corrupt' }

  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== PERSON_RELATIONSHIP_SCHEMA_VERSION) {
    return { state: 'incompatible' }
  }

  const aliases = candidate.aliases
  const movieCredits = candidate.movieCredits
  const tvCredits = candidate.tvCredits
  if (
    !Number.isInteger(candidate.personId) ||
    (candidate.personId as number) <= 0 ||
    !Array.isArray(aliases) ||
    !aliases.every((alias) => typeof alias === 'string' && alias.length > 0) ||
    !(candidate.knownForDepartment === null || typeof candidate.knownForDepartment === 'string') ||
    !Array.isArray(movieCredits) ||
    !movieCredits.every(isCredit) ||
    !Array.isArray(tvCredits) ||
    !tvCredits.every(isCredit) ||
    typeof candidate.complete !== 'boolean' ||
    typeof candidate.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(candidate.updatedAt))
  ) {
    return { state: 'corrupt' }
  }

  if (
    aliases.length > PERSON_RELATIONSHIP_MAX_ALIASES ||
    movieCredits.length + tvCredits.length > PERSON_RELATIONSHIP_MAX_CREDITS ||
    serializedSize(value) > PERSON_RELATIONSHIP_MAX_BYTES
  ) {
    return { state: 'oversized' }
  }

  const record = value as PersonRelationshipRecord
  if (!record.complete) return { state: 'incomplete', record }

  const now = options.now ?? Date.now()
  const staleTimeMs = options.staleTimeMs ?? PERSON_RELATIONSHIP_STALE_TIME_MS
  return now - Date.parse(record.updatedAt) > staleTimeMs
    ? { state: 'stale_complete', record }
    : { state: 'fresh_complete', record }
}
