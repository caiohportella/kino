import type {
  NormalizedSearchQuery,
  SearchIntent,
  SearchIntentEvidence,
  SearchMediaType,
  SearchRelationshipRole,
} from './types.ts'

const PERSON_CONFIDENCE_THRESHOLD = 0.8
const TITLE_CONFIDENCE_THRESHOLD = 0.85
const FRANCHISE_CONFIDENCE_THRESHOLD = 0.8

interface RelationshipPattern {
  readonly expression: RegExp
  readonly role: SearchRelationshipRole
  readonly mediaTypes?: readonly SearchMediaType[]
}

const RELATIONSHIP_PATTERNS: readonly RelationshipPattern[] = [
  {
    expression: /^(?:movies?|films?)\s+(?:with|starring)\s+(.+)$/iu,
    role: 'acting',
    mediaTypes: ['movie'],
  },
  {
    expression: /^(?:shows?|series)\s+(?:with|starring)\s+(.+)$/iu,
    role: 'acting',
    mediaTypes: ['series'],
  },
  {
    expression: /^(?:movies?|films?)\s+(?:directed by|from director)\s+(.+)$/iu,
    role: 'directing',
    mediaTypes: ['movie'],
  },
  {
    expression: /^(?:shows?|series)\s+(?:directed by|from director)\s+(.+)$/iu,
    role: 'directing',
    mediaTypes: ['series'],
  },
  {
    expression: /^(?:movies?|films?|shows?|series)\s+(?:created by)\s+(.+)$/iu,
    role: 'creating',
  },
  {
    expression: /^(?:movies?|films?|shows?|series)\s+(?:written by)\s+(.+)$/iu,
    role: 'writing',
  },
]

function boundedConfidence(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function withoutTerminalYear(query: NormalizedSearchQuery): string {
  return query.year === undefined
    ? query.original
    : query.original.replace(new RegExp(`\\s+${query.year}$`, 'u'), '').trim()
}

export function detectSearchIntent(
  query: NormalizedSearchQuery,
  evidence: SearchIntentEvidence
): SearchIntent {
  for (const pattern of RELATIONSHIP_PATTERNS) {
    const match = query.original.match(pattern.expression)
    const personName = match?.[1]?.trim()
    if (personName) {
      return {
        kind: 'relationship',
        personName,
        role: pattern.role,
        ...(pattern.mediaTypes === undefined ? {} : { mediaTypes: pattern.mediaTypes }),
      }
    }
  }

  const franchiseMatch = query.original.match(/^(.+?)\s+(?:franchise|saga|universe)$/iu)
  if (
    franchiseMatch?.[1] &&
    boundedConfidence(evidence.franchiseConfidence) >= FRANCHISE_CONFIDENCE_THRESHOLD
  ) {
    return { kind: 'franchise', franchiseName: franchiseMatch[1].trim() }
  }

  if (query.year !== undefined && query.tokens.length > 1) {
    return { kind: 'title_year', title: withoutTerminalYear(query), year: query.year }
  }

  if (boundedConfidence(evidence.exactTitleConfidence) >= TITLE_CONFIDENCE_THRESHOLD) {
    return { kind: 'exact_title', title: query.original }
  }

  if (boundedConfidence(evidence.personConfidence) >= PERSON_CONFIDENCE_THRESHOLD) {
    return { kind: 'person', personName: query.original }
  }

  if (
    query.tokens.length >= 3 ||
    /\b(?:19|20)\d0s\b/u.test(query.folded) ||
    /\b(?:from|about|like|similar|where|with)\b/u.test(query.folded)
  ) {
    return { kind: 'semantic_discovery' }
  }

  return { kind: 'ambiguous' }
}
