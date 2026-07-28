export const SEARCH_SCHEMA_VERSION = 1 as const

export type SearchSchemaVersion = typeof SEARCH_SCHEMA_VERSION
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
  readonly schemaVersion: SearchSchemaVersion
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
  readonly imageUrl?: string
  readonly popularity?: number
  readonly voteCount?: number
}

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

export interface SearchResultV1 {
  readonly entity: SearchEntity
  readonly score: number
  readonly sources: readonly string[]
  readonly relationship?: {
    readonly personId: string
    readonly role: string
  }
}

export type SearchResultGroupType = 'people' | 'movies' | 'series' | 'users'

export interface SearchResultGroupV1 {
  readonly type: SearchResultGroupType
  readonly results: readonly SearchResultV1[]
}

export interface SearchResponseV1 {
  readonly schemaVersion: SearchSchemaVersion
  readonly query: NormalizedSearchQuery
  readonly results: readonly SearchResultV1[]
  readonly groups: readonly SearchResultGroupV1[]
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly nextPage?: number
  readonly fallback?: 'none' | 'supplemented' | 'provider_unavailable'
}

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
  readonly supportedMinimum = SEARCH_SCHEMA_VERSION
  readonly supportedMaximum = SEARCH_SCHEMA_VERSION
  readonly upgradeRequired = true
  readonly receivedVersion: unknown

  constructor(receivedVersion: unknown) {
    super(`Unsupported search schema version: ${String(receivedVersion)}`)
    this.name = 'UnsupportedSearchVersion'
    this.receivedVersion = receivedVersion
  }
}
