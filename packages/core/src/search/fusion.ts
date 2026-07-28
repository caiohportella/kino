import type {
  FusedCandidate,
  ProviderScoreRange,
  SearchEntity,
  SearchProviderCandidate,
  SearchProviderResult,
} from './types.ts'

export function normalizeProviderScore(value: number, range: ProviderScoreRange): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(range.minimum) ||
    !Number.isFinite(range.maximum) ||
    range.maximum <= range.minimum
  ) {
    return 0
  }
  const normalized = Math.max(
    0,
    Math.min(1, (value - range.minimum) / (range.maximum - range.minimum))
  )
  return range.direction === 'lower_is_better' ? 1 - normalized : normalized
}

function entityIdentity(entity: SearchEntity): string {
  return entity.tmdbId === undefined
    ? `${entity.entityType}:${entity.id}`
    : `${entity.entityType}:${entity.tmdbId}`
}

function entityCompleteness(entity: SearchEntity): number {
  return Object.values(entity).filter((value) => value !== undefined && value !== '').length
}

function chooseEntity(left: SearchEntity, right: SearchEntity): SearchEntity {
  const completenessDifference = entityCompleteness(right) - entityCompleteness(left)
  if (completenessDifference > 0) return right
  if (completenessDifference < 0) return left
  return JSON.stringify(right) < JSON.stringify(left) ? right : left
}

function compareEntities(left: SearchEntity, right: SearchEntity): number {
  if (left.entityType !== right.entityType) return left.entityType.localeCompare(right.entityType, 'en')
  if (left.tmdbId !== undefined && right.tmdbId !== undefined && left.tmdbId !== right.tmdbId) {
    return left.tmdbId - right.tmdbId
  }
  return left.id.localeCompare(right.id, 'en')
}

function maximum(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right
  if (right === undefined) return left
  return Math.max(left, right)
}

function evidenceForCandidate(candidate: SearchProviderCandidate): Partial<FusedCandidate> {
  const localeRelevance =
    candidate.localeRelevance === undefined
      ? undefined
      : normalizeProviderScore(candidate.localeRelevance, { minimum: 0, maximum: 1 })

  switch (candidate.source) {
    case 'semantic':
      return {
        semanticScore: normalizeProviderScore(candidate.semanticScore, {
          minimum: 0,
          maximum: 1,
        }),
        ...(localeRelevance === undefined ? {} : { localeRelevance }),
      }
    case 'lexical':
      return {
        lexicalScore: normalizeProviderScore(candidate.lexicalScore, { minimum: 0, maximum: 1 }),
        ...(candidate.exactMatch === true ? { exactMatch: true } : {}),
        ...(candidate.prefixMatch === true ? { prefixMatch: true } : {}),
        ...(localeRelevance === undefined ? {} : { localeRelevance }),
      }
    case 'person':
      return {
        entityConfidence: normalizeProviderScore(candidate.confidence, {
          minimum: 0,
          maximum: 1,
        }),
        ...(localeRelevance === undefined ? {} : { localeRelevance }),
      }
    case 'relationship':
      return {
        entityConfidence: normalizeProviderScore(candidate.personConfidence, {
          minimum: 0,
          maximum: 1,
        }),
        relationshipScore: normalizeProviderScore(candidate.relationshipScore, {
          minimum: 0,
          maximum: 1,
        }),
        personId: candidate.personId,
        role: candidate.role,
        ...(localeRelevance === undefined ? {} : { localeRelevance }),
      }
  }
}

function mergeCandidate(
  existing: FusedCandidate,
  candidate: SearchProviderCandidate,
  sourceId: string
): FusedCandidate {
  const evidence = evidenceForCandidate(candidate)
  const candidateRelationshipIsStronger =
    evidence.relationshipScore !== undefined &&
    (existing.relationshipScore === undefined ||
      evidence.relationshipScore > existing.relationshipScore ||
      (evidence.relationshipScore === existing.relationshipScore &&
        (evidence.role ?? '') < (existing.role ?? '')))

  return {
    identity: existing.identity,
    entity: chooseEntity(existing.entity, candidate.entity),
    sources: [...new Set([...existing.sources, sourceId])].sort((left, right) =>
      left.localeCompare(right, 'en')
    ),
    ...(maximum(existing.semanticScore, evidence.semanticScore) === undefined
      ? {}
      : { semanticScore: maximum(existing.semanticScore, evidence.semanticScore) }),
    ...(maximum(existing.lexicalScore, evidence.lexicalScore) === undefined
      ? {}
      : { lexicalScore: maximum(existing.lexicalScore, evidence.lexicalScore) }),
    ...(existing.exactMatch === true || evidence.exactMatch === true ? { exactMatch: true } : {}),
    ...(existing.prefixMatch === true || evidence.prefixMatch === true ? { prefixMatch: true } : {}),
    ...(maximum(existing.entityConfidence, evidence.entityConfidence) === undefined
      ? {}
      : { entityConfidence: maximum(existing.entityConfidence, evidence.entityConfidence) }),
    ...(maximum(existing.relationshipScore, evidence.relationshipScore) === undefined
      ? {}
      : { relationshipScore: maximum(existing.relationshipScore, evidence.relationshipScore) }),
    ...(maximum(existing.localeRelevance, evidence.localeRelevance) === undefined
      ? {}
      : { localeRelevance: maximum(existing.localeRelevance, evidence.localeRelevance) }),
    ...(candidateRelationshipIsStronger
      ? { personId: evidence.personId, role: evidence.role }
      : existing.personId === undefined
        ? {}
        : { personId: existing.personId, role: existing.role }),
  }
}

export function fuseSearchCandidates(sources: readonly SearchProviderResult[]): FusedCandidate[] {
  const fused = new Map<string, FusedCandidate>()

  for (const source of sources) {
    for (const candidate of source.candidates) {
      const identity = entityIdentity(candidate.entity)
      const existing = fused.get(identity)
      if (existing) {
        fused.set(identity, mergeCandidate(existing, candidate, source.sourceId))
        continue
      }
      const evidence = evidenceForCandidate(candidate)
      fused.set(identity, {
        identity,
        entity: candidate.entity,
        sources: [source.sourceId],
        ...evidence,
      })
    }
  }

  return [...fused.values()].sort((left, right) => compareEntities(left.entity, right.entity))
}
