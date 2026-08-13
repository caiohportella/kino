import type {
  FusedCandidate,
  RankedSearchResult,
  RankSearchCandidatesInput,
  SearchEntity,
  SearchScoreComponents,
  SearchEntityV2,
} from './types.ts'
import { compareTitleRankingSignals, titleRankingSignals } from './title-ranking.ts'

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

function titleRankingComparison(left: FusedCandidate, right: FusedCandidate): number {
  if (!isTitleRankingCandidate(left) || !isTitleRankingCandidate(right)) return 0

  const leftEntity = left.entity as TitleRankingEntity
  const rightEntity = right.entity as TitleRankingEntity

  return compareTitleRankingSignals(
    titleRankingSignals(
      {
        exactMatch: left.exactMatch,
        prefixMatch: left.prefixMatch,
        lexicalScore: left.lexicalScore,
        semanticScore: left.semanticScore,
      },
      {
        voteCount: left.entity.voteCount,
        popularity: left.entity.popularity,
        voteAverage:
          leftEntity.tmdbVoteAverage ?? leftEntity.kinoAverageRating ?? leftEntity.voteAverage,
      }
    ),
    titleRankingSignals(
      {
        exactMatch: right.exactMatch,
        prefixMatch: right.prefixMatch,
        lexicalScore: right.lexicalScore,
        semanticScore: right.semanticScore,
      },
      {
        voteCount: right.entity.voteCount,
        popularity: right.entity.popularity,
        voteAverage:
          rightEntity.tmdbVoteAverage ??
          rightEntity.kinoAverageRating ??
          rightEntity.voteAverage,
      }
    )
  )
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

export function rankSearchCandidates(input: RankSearchCandidatesInput): RankedSearchResult[] {
  return input.candidates
    .map((candidate) => {
      const components = scoreComponents(candidate, input.query.year)
      const score = Math.round(weightedScore(components) * 1_000_000) / 1_000_000
      return {
        identity: candidate.identity,
        entity: candidate.entity,
        score,
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
    .sort(
      (left, right) =>
        titleRankingComparison(left.candidate, right.candidate) ||
        right.score - left.score ||
        compareStableEntity(left.candidate, right.candidate)
    )
    .map(({ candidate: _candidate, ...result }) => result)
}
