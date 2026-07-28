import type {
  PersonCandidate,
  PersonCredit,
  RelationshipCandidate,
  RelationshipCreditRole,
  SearchIntent,
} from './types.ts'

function roundScore(value: number): number {
  return Math.round(value * 100) / 100
}

function castProminence(castOrder: number | undefined): number {
  const order =
    typeof castOrder === 'number' && Number.isFinite(castOrder)
      ? Math.max(0, Math.min(20, castOrder))
      : 20
  return 1 - order / 20
}

function scoreCredit(credit: PersonCredit, intent: SearchIntent): number {
  if (credit.appearance === 'archive') return 0.15
  if (credit.appearance === 'self') return 0.25

  if (intent.kind === 'relationship') {
    if (credit.role === intent.role) {
      return credit.role === 'acting'
        ? roundScore(0.75 + 0.25 * castProminence(credit.castOrder))
        : 1
    }
    return credit.role === 'acting'
      ? roundScore(0.45 + 0.1 * castProminence(credit.castOrder))
      : 0.35
  }

  const roleScores: Readonly<Record<RelationshipCreditRole, number>> = {
    acting: roundScore(0.75 + 0.25 * castProminence(credit.castOrder)),
    directing: 0.85,
    creating: 0.85,
    writing: 0.75,
  }
  return roleScores[credit.role]
}

function stableIdentity(candidate: RelationshipCandidate): string {
  const entity = candidate.entity
  return JSON.stringify([
    entity.entityType,
    entity.tmdbId.toString().padStart(12, '0'),
    entity.id,
    entity.title,
    entity.year ?? null,
    entity.locale ?? null,
    entity.route ?? null,
    entity.summary ?? null,
    entity.imageUrl ?? null,
    entity.popularity ?? null,
    entity.voteCount ?? null,
    candidate.castOrder ?? null,
  ])
}

function strongerCredit(
  candidate: RelationshipCandidate,
  existing: RelationshipCandidate
): boolean {
  if (candidate.relationshipScore !== existing.relationshipScore) {
    return candidate.relationshipScore > existing.relationshipScore
  }
  if (candidate.role !== existing.role) return candidate.role < existing.role
  return stableIdentity(candidate) < stableIdentity(existing)
}

export function expandPersonCredits(
  person: PersonCandidate,
  credits: readonly PersonCredit[],
  intent: SearchIntent
): RelationshipCandidate[] {
  const allowedMediaTypes =
    intent.kind === 'relationship' && intent.mediaTypes ? new Set(intent.mediaTypes) : undefined
  const byEntity = new Map<string, RelationshipCandidate>()

  for (const credit of credits) {
    if (allowedMediaTypes && !allowedMediaTypes.has(credit.entity.entityType)) continue
    const key = `${credit.entity.entityType}:${credit.entity.tmdbId}`
    const candidate: RelationshipCandidate = {
      source: 'relationship',
      entity: credit.entity,
      personId: person.entity.id,
      personConfidence: person.confidence,
      role: credit.role,
      relationshipScore: scoreCredit(credit, intent),
      ...(credit.castOrder === undefined ? {} : { castOrder: credit.castOrder }),
    }
    const existing = byEntity.get(key)
    if (!existing || strongerCredit(candidate, existing)) byEntity.set(key, candidate)
  }

  return [...byEntity.values()].sort(
    (left, right) =>
      right.relationshipScore - left.relationshipScore ||
      stableIdentity(left).localeCompare(stableIdentity(right), 'en')
  )
}
