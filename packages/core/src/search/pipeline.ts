import { fuseSearchCandidates } from './fusion.ts'
import { detectSearchIntent } from './intent.ts'
import { normalizeSearchQuery, normalizeSearchRequestV1 } from './normalize.ts'
import { expandPersonCredits } from './person-expansion.ts'
import { rankSearchCandidates } from './rank.ts'
import {
  type RankedSearchResult,
  type RunSearchPipelineV1Input,
  SEARCH_SCHEMA_VERSION,
  type SearchMediaType,
  type SearchProviderResult,
  type SearchResponseV1,
  type SearchResultGroupType,
  type SearchResultGroupV1,
  type SearchResultV1,
} from './types.ts'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

const GROUP_ORDER: readonly SearchResultGroupType[] = ['people', 'movies', 'series', 'users']

function groupTypeForResult(result: SearchResultV1): SearchResultGroupType {
  switch (result.entity.entityType) {
    case 'person':
      return 'people'
    case 'movie':
      return 'movies'
    case 'series':
      return 'series'
    case 'user':
      return 'users'
  }
}

function serializeRankedResult(result: RankedSearchResult): SearchResultV1 {
  return {
    entity: result.entity,
    score: result.score,
    sources: result.sources,
    ...(result.relationship === undefined ? {} : { relationship: result.relationship }),
  }
}

function dedupeRankedResults(results: readonly RankedSearchResult[]): RankedSearchResult[] {
  const seen = new Set<string>()
  return results.filter((result) => {
    if (seen.has(result.identity)) return false
    seen.add(result.identity)
    return true
  })
}

function groupResults(results: readonly SearchResultV1[]): SearchResultGroupV1[] {
  return GROUP_ORDER.flatMap((type) => {
    const groupedResults = results.filter((result) => groupTypeForResult(result) === type)
    return groupedResults.length === 0 ? [] : [{ type, results: groupedResults }]
  })
}

function enforceMediaTypes(
  sources: readonly SearchProviderResult[],
  mediaTypes: readonly SearchMediaType[] | undefined
): SearchProviderResult[] {
  if (mediaTypes === undefined) return [...sources]
  const allowed = new Set(mediaTypes)
  return sources.map((source) => ({
    ...source,
    candidates: source.candidates.filter(
      (candidate) =>
        !['movie', 'series'].includes(candidate.entity.entityType) ||
        allowed.has(candidate.entity.entityType as SearchMediaType)
    ),
  }))
}

export function runSearchPipelineV1(input: RunSearchPipelineV1Input): SearchResponseV1 {
  const request = normalizeSearchRequestV1(input.request)
  const query = normalizeSearchQuery(request.query)
  const intent = detectSearchIntent(query, input.intentEvidence)
  const relationshipCandidates =
    input.personExpansion === undefined || !['person', 'relationship'].includes(intent.kind)
      ? []
      : expandPersonCredits(input.personExpansion.person, input.personExpansion.credits, intent)
  const sources =
    relationshipCandidates.length === 0
      ? input.sources
      : [
          ...input.sources,
          {
            sourceId: 'person-expansion',
            candidates: relationshipCandidates,
          },
        ]
  const constrainedSources = enforceMediaTypes(sources, request.mediaTypes)
  const fused = fuseSearchCandidates(constrainedSources)
  const ranked = dedupeRankedResults(rankSearchCandidates({ query, candidates: fused })).map(
    serializeRankedResult
  )
  const page = request.page ?? DEFAULT_PAGE
  const limit = request.limit ?? DEFAULT_LIMIT
  const start = (page - 1) * limit
  const end = start + limit
  const untrimmedGroups = groupResults(ranked)
  const groups = untrimmedGroups.flatMap((group) => {
    const results = group.results.slice(start, end)
    return results.length === 0 ? [] : [{ ...group, results }]
  })
  const results = groups.flatMap((group) => group.results)

  return {
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query,
    results,
    groups,
    total: ranked.length,
    page,
    limit,
    ...(untrimmedGroups.some((group) => end < group.results.length) ? { nextPage: page + 1 } : {}),
    fallback: input.fallback ?? 'none',
  }
}
