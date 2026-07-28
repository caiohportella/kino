import type { SearchIndexSchemaVersion } from './version.ts'

export type SearchIndexEntityType = 'movie' | 'series' | 'person'
export type SearchIndexMediaType = Exclude<SearchIndexEntityType, 'person'>
export type SearchIndexRelationshipRole = 'acting' | 'directing' | 'creating' | 'writing'

export interface NormalizedIndexPersonReference {
  readonly id: string
  readonly name: string
  readonly role: SearchIndexRelationshipRole
  readonly character?: string
  readonly castOrder?: number
}

export interface NormalizedIndexTitleReference {
  readonly id: string
  readonly entityType: SearchIndexMediaType
  readonly title: string
  readonly role: SearchIndexRelationshipRole
  readonly character?: string
  readonly castOrder?: number
}

interface NormalizedMediaIndexInputBase {
  readonly id: string
  readonly tmdbId: number
  readonly title: string
  readonly originalTitle?: string
  readonly alternativeTitles?: readonly string[]
  readonly overview?: string
  readonly releaseDate?: string
  readonly locale?: string
  readonly genres?: readonly string[]
  readonly keywords?: readonly string[]
  readonly franchise?: string
  readonly people?: readonly NormalizedIndexPersonReference[]
}

export interface NormalizedMovieIndexInput extends NormalizedMediaIndexInputBase {
  readonly entityType: 'movie'
}

export interface NormalizedSeriesIndexInput extends NormalizedMediaIndexInputBase {
  readonly entityType: 'series'
}

export interface NormalizedPersonIndexInput {
  readonly id: string
  readonly entityType: 'person'
  readonly tmdbId: number
  readonly name: string
  readonly alternativeNames?: readonly string[]
  readonly biography?: string
  readonly locale?: string
  readonly knownForDepartment?: string
  readonly relationships?: readonly NormalizedIndexTitleReference[]
}

export type NormalizedSearchIndexInput =
  | NormalizedMovieIndexInput
  | NormalizedSeriesIndexInput
  | NormalizedPersonIndexInput

export interface SearchIndexMediaMetadataV1 {
  readonly tmdbId: number
  readonly title: string
  readonly originalTitle?: string
  readonly alternativeTitles: readonly string[]
  readonly overview?: string
  readonly releaseDate?: string
  readonly locale?: string
  readonly genres: readonly string[]
  readonly keywords: readonly string[]
  readonly franchise?: string
  readonly people: readonly NormalizedIndexPersonReference[]
}

export interface SearchIndexPersonMetadataV1 {
  readonly tmdbId: number
  readonly name: string
  readonly alternativeNames: readonly string[]
  readonly biography?: string
  readonly locale?: string
  readonly knownForDepartment?: string
  readonly relationships: readonly NormalizedIndexTitleReference[]
}

export type SearchIndexMetadataV1 = SearchIndexMediaMetadataV1 | SearchIndexPersonMetadataV1

interface SearchIndexDocumentBaseV1 {
  readonly id: string
  readonly searchableText: string
  readonly contentHash: string
  readonly indexVersion: SearchIndexSchemaVersion
}

export interface SearchIndexMovieDocumentV1 extends SearchIndexDocumentBaseV1 {
  readonly entityType: 'movie'
  readonly metadata: SearchIndexMediaMetadataV1
}

export interface SearchIndexSeriesDocumentV1 extends SearchIndexDocumentBaseV1 {
  readonly entityType: 'series'
  readonly metadata: SearchIndexMediaMetadataV1
}

export interface SearchIndexPersonDocumentV1 extends SearchIndexDocumentBaseV1 {
  readonly entityType: 'person'
  readonly metadata: SearchIndexPersonMetadataV1
}

export type SearchIndexDocumentV1 =
  | SearchIndexMovieDocumentV1
  | SearchIndexSeriesDocumentV1
  | SearchIndexPersonDocumentV1

export type UnversionedSearchIndexDocumentV1 =
  | Omit<SearchIndexMovieDocumentV1, 'indexVersion'>
  | Omit<SearchIndexSeriesDocumentV1, 'indexVersion'>
  | Omit<SearchIndexPersonDocumentV1, 'indexVersion'>
