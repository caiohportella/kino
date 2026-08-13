export type TitleMatchTier = 'strong' | 'medium' | 'fuzzy' | 'weak'

export interface TitleRankingEvidence {
  readonly exactMatch?: boolean
  readonly prefixMatch?: boolean
  readonly lexicalScore?: number
  readonly semanticScore?: number
}

export interface TitleAudienceMetrics {
  readonly voteCount?: number | null
  readonly popularity?: number | null
  readonly voteAverage?: number | null
}

export interface TitleRankingSignals {
  readonly tier: TitleMatchTier
  readonly audienceScore: number
  readonly textScore: number
  readonly voteAverage: number
}

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function sanitizedNonNegative(value: number | null | undefined): number {
  return Math.max(0, finiteOrZero(value))
}

function tierRank(tier: TitleMatchTier): number {
  switch (tier) {
    case 'strong':
      return 3
    case 'medium':
      return 2
    case 'fuzzy':
      return 1
    case 'weak':
      return 0
  }
}

export function classifyTitleMatch(evidence: TitleRankingEvidence): TitleMatchTier {
  if (evidence.exactMatch === true || evidence.prefixMatch === true) return 'strong'

  const lexicalScore = finiteOrZero(evidence.lexicalScore)
  if (lexicalScore >= 0.8) return 'strong'
  if (lexicalScore >= 0.6) return 'medium'

  const semanticScore = finiteOrZero(evidence.semanticScore)
  if (semanticScore >= 0.35) return 'fuzzy'

  return 'weak'
}

export function titleAudienceScore(metrics: TitleAudienceMetrics): number {
  const voteCount = sanitizedNonNegative(metrics.voteCount)
  const popularity = sanitizedNonNegative(metrics.popularity)

  return Math.log1p(voteCount) * 0.75 + Math.log1p(popularity) * 0.25
}

export function titleRankingSignals(
  evidence: TitleRankingEvidence,
  metrics: TitleAudienceMetrics
): TitleRankingSignals {
  const lexicalScore = finiteOrZero(evidence.lexicalScore)
  const semanticScore = finiteOrZero(evidence.semanticScore)
  const textScore = Math.max(lexicalScore, semanticScore, evidence.exactMatch === true ? 1 : 0)

  return {
    tier: classifyTitleMatch(evidence),
    audienceScore: titleAudienceScore(metrics),
    textScore,
    voteAverage: finiteOrZero(metrics.voteAverage),
  }
}

export function compareTitleRankingSignals(
  left: TitleRankingSignals,
  right: TitleRankingSignals
): number {
  const tierDifference = tierRank(right.tier) - tierRank(left.tier)
  if (tierDifference !== 0) return tierDifference

  if (left.tier === 'strong' && right.tier === 'strong') {
    const audienceDifference = right.audienceScore - left.audienceScore
    if (audienceDifference !== 0) return audienceDifference
  }

  const textDifference = right.textScore - left.textScore
  if (textDifference !== 0) return textDifference

  return right.voteAverage - left.voteAverage
}
