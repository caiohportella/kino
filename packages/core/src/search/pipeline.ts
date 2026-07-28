import { fuseSearchCandidates } from './fusion.ts'
import { detectSearchIntent } from './intent.ts'
import { normalizeSearchQuery, normalizeSearchRequestV1 } from './normalize.ts'
import { expandPersonCredits } from './person-expansion.ts'
import { rankSearchCandidates } from './rank.ts'
import {
  type RankedSearchResult,
  type RunSearchPipelineV1Input,
  SEARCH_SCHEMA_VERSION,
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

function groupResults(results: readonly SearchResultV1[]): SearchResultGroupV1[] {
  return GROUP_ORDER.flatMap((type) => {
    const groupedResults = results.filter((result) => groupTypeForResult(result) === type)
    return groupedResults.length === 0 ? [] : [{ type, results: groupedResults }]
  })
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
  const fused = fuseSearchCandidates(sources)
  const ranked = rankSearchCandidates({ query, candidates: fused }).map(serializeRankedResult)
  const page = request.page ?? DEFAULT_PAGE
  const limit = request.limit ?? DEFAULT_LIMIT
  const start = (page - 1) * limit
  const end = start + limit
  const results = ranked.slice(start, end)

  return {
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query,
    results,
    groups: groupResults(results),
    total: ranked.length,
    page,
    limit,
    ...(end < ranked.length ? { nextPage: page + 1 } : {}),
    fallback: input.fallback ?? 'none',
  }
}
