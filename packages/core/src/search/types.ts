export const SEARCH_SCHEMA_VERSION_V1 = 1 as const
export const SEARCH_SCHEMA_VERSION_V2 = 2 as const

/** @deprecated Use SEARCH_SCHEMA_VERSION_V1 or SEARCH_SCHEMA_VERSION_V2 explicitly. */
export const SEARCH_SCHEMA_VERSION = SEARCH_SCHEMA_VERSION_V1

export type SearchSchemaVersion = typeof SEARCH_SCHEMA_VERSION_V1 | typeof SEARCH_SCHEMA_VERSION_V2
export type SearchMediaType = 'movie' | 'series'
export type SearchEntityType = SearchMediaType | 'person' | 'user'

export interface NormalizedSearchQuery {
  readonly original: string
  readonly folded: string
  readonly tokens: readonly string[]
  readonly year?: number
}

export type SearchRelationshipRole = 'acting' | 'directing' | 'creating' | 'writing'

export type SearchIntent =
  | { readonly kind: 'exact_title'; readonly title: string }
  | { readonly kind: 'title_year'; readonly title: string; readonly year: number }
  | { readonly kind: 'person'; readonly personName: string }
  | {
      readonly kind: 'relationship'
      readonly personName: string
      readonly role: SearchRelationshipRole
      readonly mediaTypes?: readonly SearchMediaType[]
    }
  | { readonly kind: 'franchise'; readonly franchiseName: string }
  | { readonly kind: 'semantic_discovery' }
  | { readonly kind: 'ambiguous' }

export interface SearchIntentEvidence {
  readonly exactTitleConfidence?: number
  readonly personConfidence?: number
  readonly franchiseConfidence?: number
}

export interface SearchRequestV1 {
  readonly schemaVersion: typeof SEARCH_SCHEMA_VERSION_V1
  readonly query: string
  readonly locale?: string
  readonly region?: string
  readonly mediaTypes?: readonly SearchMediaType[]
  readonly page?: number
  readonly limit?: number
}

export interface SearchEntity {
  readonly id: string
  readonly entityType: SearchEntityType
  readonly title: string
  readonly tmdbId?: number
  readonly year?: number
  readonly locale?: string
  readonly route?: string
  readonly summary?: string
  readonly department?: string
  readonly imageUrl?: string
  readonly popularity?: number
  readonly voteCount?: number
}

/**
 * V2 keeps content ratings separate from relevance and ranking evidence.
 * Missing source ratings are represented as null or omitted, never as a score.
 */
export interface SearchEntityV2 extends SearchEntity {
  readonly tmdbVoteAverage?: number | null
  readonly kinoAverageRating?: number | null
}

export interface CreditSearchScore {
  readonly relationshipScore: number
  readonly semanticScore: number
  readonly popularityScore: number
  readonly voteConfidenceScore: number
  readonly castOrderScore: number
}

export interface SearchRequestV2 {
  readonly schemaVersion: typeof SEARCH_SCHEMA_VERSION_V2
  readonly query: string
  readonly locale?: string
  readonly region?: string
  readonly mediaTypes?: readonly SearchMediaType[]
  readonly page?: number
  readonly limit?: number
}

export type SearchRequest = SearchRequestV1 | SearchRequestV2
export type CompatibleSearchRequest = SearchRequest

interface CandidateBase {
  readonly entity: SearchEntity
  readonly localeRelevance?: number
}

export interface SemanticCandidate extends CandidateBase {
  readonly source: 'semantic'
  readonly semanticScore: number
}

export interface LexicalCandidate extends CandidateBase {
  readonly source: 'lexical'
  readonly lexicalScore: number
  readonly exactMatch?: boolean
  readonly prefixMatch?: boolean
}

export interface PersonCandidate extends CandidateBase {
  readonly source: 'person'
  readonly entity: SearchEntity & { readonly entityType: 'person' }
  readonly confidence: number
}

export type RelationshipCreditRole = SearchRelationshipRole
export type RelationshipAppearance = 'standard' | 'self' | 'archive'

export interface PersonCredit {
  readonly entity: SearchEntity & { readonly entityType: SearchMediaType; readonly tmdbId: number }
  readonly role: RelationshipCreditRole
  readonly castOrder?: number
  readonly appearance?: RelationshipAppearance
}

export interface RelationshipCandidate extends CandidateBase {
  readonly source: 'relationship'
  readonly entity: SearchEntity & { readonly entityType: SearchMediaType; readonly tmdbId: number }
  readonly personId: string
  readonly personConfidence: number
  readonly role: RelationshipCreditRole
  readonly relationshipScore: number
  readonly castOrder?: number
}

export type SearchProviderCandidate =
  | SemanticCandidate
  | LexicalCandidate
  | PersonCandidate
  | RelationshipCandidate

export interface SearchProviderResult {
  readonly sourceId: string
  readonly candidates: readonly SearchProviderCandidate[]
  readonly degraded?: boolean
}

export interface ProviderScoreRange {
  readonly minimum: number
  readonly maximum: number
  readonly direction?: 'higher_is_better' | 'lower_is_better'
}

export interface FusedCandidate {
  readonly identity: string
  readonly entity: SearchEntity
  readonly sources: readonly string[]
  readonly semanticScore?: number
  readonly lexicalScore?: number
  readonly exactMatch?: boolean
  readonly prefixMatch?: boolean
  readonly entityConfidence?: number
  readonly relationshipScore?: number
  readonly localeRelevance?: number
  readonly personId?: string
  readonly role?: RelationshipCreditRole
}

export interface SearchScoreComponents {
  readonly exact: number
  readonly prefix: number
  readonly lexical: number
  readonly semantic: number
  readonly entityConfidence: number
  readonly relationship: number
  readonly locale: number
  readonly popularity: number
  readonly voteConfidence: number
  readonly release: number
}

export interface RankedSearchResult extends SearchResultV1 {
  readonly identity: string
  readonly components: SearchScoreComponents
}

export interface RankSearchCandidatesInput {
  readonly query: NormalizedSearchQuery
  readonly candidates: readonly FusedCandidate[]
}

export interface RunSearchPipelineV1Input {
  readonly request: SearchRequestV1
  readonly intentEvidence: SearchIntentEvidence
  readonly sources: readonly SearchProviderResult[]
  readonly personExpansion?: {
    readonly person: PersonCandidate
    readonly credits: readonly PersonCredit[]
  }
  readonly fallback?: SearchResponseV1['fallback']
}

export interface RunSearchPipelineV2Input {
  readonly request: SearchRequestV2
  readonly intentEvidence: SearchIntentEvidence
  readonly sources: readonly SearchProviderResult[]
  readonly personExpansion?: {
    readonly person: PersonCandidate
    readonly credits: readonly PersonCredit[]
  }
  readonly fallback?: SearchResponseV2['fallback']
}

export interface SearchResultV1 {
  readonly entity: SearchEntity
  readonly score: number
  readonly sources: readonly string[]
  readonly relationship?: {
    readonly personId: string
    readonly role: SearchRelationshipRole
  }
}

export type SearchResultGroupType = 'people' | 'movies' | 'series' | 'users'

export interface SearchResultGroupV1 {
  readonly type: SearchResultGroupType
  readonly results: readonly SearchResultV1[]
}

export interface SearchResponseV1 {
  readonly schemaVersion: typeof SEARCH_SCHEMA_VERSION_V1
  readonly query: NormalizedSearchQuery
  /** The current per-group page flattened in people, movies, series, users order. */
  readonly results: readonly SearchResultV1[]
  /** Each canonical group is independently sliced by page and limit after ranking. */
  readonly groups: readonly SearchResultGroupV1[]
  /** Total deduplicated results across all groups before pagination. */
  readonly total: number
  readonly page: number
  readonly limit: number
  /** Present while at least one canonical group has another page. */
  readonly nextPage?: number
  readonly fallback?: 'none' | 'supplemented' | 'provider_unavailable'
}

export interface SearchResultV2 {
  readonly entity: SearchEntityV2
  readonly score: CreditSearchScore
  readonly sources: readonly string[]
  readonly relationship?: {
    readonly personId: string
    readonly role: SearchRelationshipRole
  }
}

export interface SearchResultGroupV2 {
  readonly type: SearchResultGroupType
  readonly results: readonly SearchResultV2[]
}

export interface SearchResponseV2 {
  readonly schemaVersion: typeof SEARCH_SCHEMA_VERSION_V2
  readonly query: NormalizedSearchQuery
  readonly results: readonly SearchResultV2[]
  readonly groups: readonly SearchResultGroupV2[]
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly nextPage?: number
  readonly fallback?: 'none' | 'supplemented' | 'provider_unavailable'
}

export type SearchResponse = SearchResponseV1 | SearchResponseV2
export type CompatibleSearchResponse = SearchResponse

export interface UnsupportedSearchVersionError {
  readonly code: 'unsupported_version'
  readonly supportedMinimum: SearchSchemaVersion
  readonly supportedMaximum: SearchSchemaVersion
  readonly upgradeRequired: true
}

export interface TemporarySearchUnavailableError {
  readonly code: 'temporary_unavailable'
  readonly retryable: true
}

export type SearchError = UnsupportedSearchVersionError | TemporarySearchUnavailableError

export class UnsupportedSearchVersion extends Error implements UnsupportedSearchVersionError {
  readonly code = 'unsupported_version'
  readonly supportedMinimum: SearchSchemaVersion
  readonly supportedMaximum: SearchSchemaVersion
  readonly upgradeRequired = true
  readonly receivedVersion: unknown

  constructor(
    receivedVersion: unknown,
    supportedMinimum: SearchSchemaVersion = SEARCH_SCHEMA_VERSION_V1,
    supportedMaximum: SearchSchemaVersion = SEARCH_SCHEMA_VERSION_V2
  ) {
    super(`Unsupported search schema version: ${String(receivedVersion)}`)
    this.name = 'UnsupportedSearchVersion'
    this.receivedVersion = receivedVersion
    this.supportedMinimum = supportedMinimum
    this.supportedMaximum = supportedMaximum
  }
}
