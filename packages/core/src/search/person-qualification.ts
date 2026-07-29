import type { NormalizedSearchQuery, PersonCandidate, SearchIntent } from './types.ts'

const EXACT_PERSON_THRESHOLD = 0.8
const RELATIONSHIP_PERSON_THRESHOLD = 0.5
const NAME_EVIDENCE_THRESHOLD = 0.8

export interface PersonExpansionEvidence {
  readonly intent: SearchIntent
  readonly person: PersonCandidate
  readonly aliasScore?: number
  readonly lexicalNameScore?: number
}

function bounded(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0
}

export function qualifyPersonExpansion(
  _query: NormalizedSearchQuery,
  evidence: PersonExpansionEvidence
): boolean {
  if (!['person', 'relationship'].includes(evidence.intent.kind)) return false

  if (evidence.intent.kind === 'relationship') {
    return bounded(evidence.person.confidence) >= RELATIONSHIP_PERSON_THRESHOLD
  }

  return (
    bounded(evidence.person.confidence) >= EXACT_PERSON_THRESHOLD ||
    bounded(evidence.aliasScore) >= NAME_EVIDENCE_THRESHOLD ||
    bounded(evidence.lexicalNameScore) >= NAME_EVIDENCE_THRESHOLD
  )
}
