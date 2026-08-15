import { compareTitleRankingSignals, titleRankingSignals } from './title-ranking.ts'
import type {
  FusedCandidate,
  RankedSearchResult,
  RankSearchCandidatesInput,
  SearchEntity,
  SearchEntityV2,
  SearchScoreComponents,
} from './types.ts'

export const SEARCH_EXACT_MATCH_WEIGHT = 0.28
export const SEARCH_PREFIX_MATCH_WEIGHT = 0.1
export const SEARCH_LEXICAL_WEIGHT = 0.12
export const SEARCH_SEMANTIC_WEIGHT = 0.24
export const SEARCH_ENTITY_CONFIDENCE_WEIGHT = 0.15
export const SEARCH_RELATIONSHIP_WEIGHT = 0.25
export const SEARCH_LOCALE_WEIGHT = 0.04
export const SEARCH_POPULARITY_WEIGHT = 0.04
export const SEARCH_RELEASE_WEIGHT = 0.07

function bounded(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function popularityScore(entity: SearchEntity): number {
  return bounded(Math.log10(1 + Math.max(0, entity.popularity ?? 0)) / 6)
}

function voteConfidence(entity: SearchEntity): number {
  return entity.voteCount === undefined
    ? 0.5
    : bounded(Math.log10(1 + Math.max(0, entity.voteCount)) / 6)
}

function releaseRelevance(candidate: FusedCandidate, queryYear: number | undefined): number {
  if (queryYear === undefined || candidate.entity.year === undefined) return 0
  const difference = Math.abs(queryYear - candidate.entity.year)
  if (difference === 0) return 1
  if (difference === 1) return 0.5
  return 0
}

function scoreComponents(
  candidate: FusedCandidate,
  queryYear: number | undefined
): SearchScoreComponents {
  const exact = candidate.exactMatch === true ? 1 : 0
  const prefix = candidate.prefixMatch === true ? 1 : 0
  const lexical = bounded(candidate.lexicalScore)
  const semantic = bounded(candidate.semanticScore)
  const entityConfidence = bounded(candidate.entityConfidence)
  const relationship = bounded(candidate.relationshipScore)
  const locale = bounded(candidate.localeRelevance)
  const relevance = Math.max(exact, prefix, lexical, semantic, entityConfidence, relationship)

  return {
    exact,
    prefix,
    lexical,
    semantic,
    entityConfidence,
    relationship,
    locale,
    popularity: popularityScore(candidate.entity) * relevance,
    voteConfidence: voteConfidence(candidate.entity),
    release: releaseRelevance(candidate, queryYear),
  }
}

function weightedScore(components: SearchScoreComponents): number {
  return (
    components.exact * SEARCH_EXACT_MATCH_WEIGHT +
    components.prefix * SEARCH_PREFIX_MATCH_WEIGHT +
    components.lexical * SEARCH_LEXICAL_WEIGHT +
    components.semantic * SEARCH_SEMANTIC_WEIGHT +
    components.entityConfidence * SEARCH_ENTITY_CONFIDENCE_WEIGHT +
    components.relationship * SEARCH_RELATIONSHIP_WEIGHT +
    components.locale * SEARCH_LOCALE_WEIGHT +
    components.popularity * SEARCH_POPULARITY_WEIGHT +
    components.release * SEARCH_RELEASE_WEIGHT
  )
}

type TitleRankingEntity = SearchEntity &
  Partial<SearchEntityV2> & {
    readonly voteAverage?: number | null
  }

function isTitleRankingCandidate(candidate: FusedCandidate): boolean {
  return (
    (candidate.entity.entityType === 'movie' || candidate.entity.entityType === 'series') &&
    candidate.personId === undefined &&
    candidate.role === undefined &&
    candidate.relationshipScore === undefined
  )
}

function titleRankingSignalsForCandidate(
  candidate: FusedCandidate
): ReturnType<typeof titleRankingSignals> | undefined {
  if (!isTitleRankingCandidate(candidate)) return undefined

  const entity = candidate.entity as TitleRankingEntity
  return titleRankingSignals(
    {
      exactMatch: candidate.exactMatch,
      prefixMatch: candidate.prefixMatch,
      lexicalScore: candidate.lexicalScore,
      semanticScore: candidate.semanticScore,
    },
    {
      voteCount: candidate.entity.voteCount,
      popularity: candidate.entity.popularity,
      voteAverage: entity.tmdbVoteAverage ?? entity.kinoAverageRating ?? entity.voteAverage,
    }
  )
}

function titleRankingComparison(left: FusedCandidate, right: FusedCandidate): number {
  const leftSignals = titleRankingSignalsForCandidate(left)
  const rightSignals = titleRankingSignalsForCandidate(right)
  if (leftSignals === undefined || rightSignals === undefined) return 0
  return compareTitleRankingSignals(leftSignals, rightSignals)
}

function isMediaCandidate(candidate: FusedCandidate): boolean {
  return candidate.entity.entityType === 'movie' || candidate.entity.entityType === 'series'
}

function titleRankingScore(signals: ReturnType<typeof titleRankingSignals>): number {
  const audience = signals.audienceScore / (1 + signals.audienceScore)
  const text = bounded(signals.textScore)
  const voteAverage = bounded(signals.voteAverage / 10)
  const score =
    signals.tier === 'strong'
      ? 0.7 + audience * 0.25 + text * 0.03 + voteAverage * 0.001
      : signals.tier === 'medium'
        ? 0.45 + audience * 0.05 + text * 0.15 + voteAverage * 0.001
        : signals.tier === 'fuzzy'
          ? 0.25 + audience * 0.05 + text * 0.15 + voteAverage * 0.001
          : audience * 0.05 + text * 0.15 + voteAverage * 0.001

  return Math.round(score * 1_000_000) / 1_000_000
}

function relationshipRankingScore(components: SearchScoreComponents): number {
  const score =
    0.66 +
    components.relationship * 0.05 +
    components.entityConfidence * 0.02 +
    components.locale * 0.005

  return Math.round(score * 1_000_000) / 1_000_000
}

function intrinsicMediaScore(
  candidate: FusedCandidate,
  components: SearchScoreComponents,
  weighted: number
): number {
  const titleSignals = titleRankingSignalsForCandidate(candidate)
  if (titleSignals !== undefined) return titleRankingScore(titleSignals)
  if (isMediaCandidate(candidate) && candidate.relationshipScore !== undefined) {
    return relationshipRankingScore(components)
  }
  return Math.round(weighted * 1_000_000) / 1_000_000
}

function compareStableEntity(left: FusedCandidate, right: FusedCandidate): number {
  if (left.entity.entityType !== right.entity.entityType) {
    return left.entity.entityType.localeCompare(right.entity.entityType, 'en')
  }
  if (
    left.entity.tmdbId !== undefined &&
    right.entity.tmdbId !== undefined &&
    left.entity.tmdbId !== right.entity.tmdbId
  ) {
    return left.entity.tmdbId - right.entity.tmdbId
  }
  return left.identity.localeCompare(right.identity, 'en')
}

type RankSortRecord = {
  readonly candidate: FusedCandidate
  readonly score: number
  readonly sortScore: number
}

function compareRankRecords(left: RankSortRecord, right: RankSortRecord): number {
  const leftIsTitle = isTitleRankingCandidate(left.candidate)
  const rightIsTitle = isTitleRankingCandidate(right.candidate)

  if (leftIsTitle && rightIsTitle) {
    return (
      titleRankingComparison(left.candidate, right.candidate) ||
      right.score - left.score ||
      compareStableEntity(left.candidate, right.candidate)
    )
  }

  const mixedMediaTitles =
    isMediaCandidate(left.candidate) &&
    isMediaCandidate(right.candidate) &&
    leftIsTitle !== rightIsTitle
  if (mixedMediaTitles) {
    return right.score - left.score || compareStableEntity(left.candidate, right.candidate)
  }

  if (isMediaCandidate(left.candidate) && isMediaCandidate(right.candidate)) {
    return right.score - left.score || compareStableEntity(left.candidate, right.candidate)
  }

  return right.sortScore - left.sortScore || compareStableEntity(left.candidate, right.candidate)
}

export function rankSearchCandidates(input: RankSearchCandidatesInput): RankedSearchResult[] {
  const sorted = input.candidates
    .map((candidate) => {
      const components = scoreComponents(candidate, input.query.year)
      const weighted = weightedScore(components)
      const score = intrinsicMediaScore(candidate, components, weighted)
      return {
        identity: candidate.identity,
        entity: candidate.entity,
        score,
        sortScore: Math.round(weighted * 1_000_000) / 1_000_000,
        sources: candidate.sources,
        components,
        ...(candidate.personId === undefined || candidate.role === undefined
          ? {}
          : {
              relationship: {
                personId: candidate.personId,
                role: candidate.role,
              },
            }),
        candidate,
      }
    })
    .sort(compareRankRecords)

  return sorted.map(({ candidate: _candidate, sortScore: _sortScore, ...result }) => result)
}
