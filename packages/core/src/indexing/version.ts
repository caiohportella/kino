import type {
  SearchIndexDocumentPayloadV1,
  UnversionedSearchIndexDocumentPayloadV1,
} from './types.ts'

export const SEARCH_INDEX_SCHEMA_VERSION = 1 as const

export type SearchIndexSchemaVersion = typeof SEARCH_INDEX_SCHEMA_VERSION

export const versionSearchIndexDocumentPayloadV1 = (
  document: UnversionedSearchIndexDocumentPayloadV1
): SearchIndexDocumentPayloadV1 =>
  ({
    ...document,
    indexVersion: SEARCH_INDEX_SCHEMA_VERSION,
  }) as SearchIndexDocumentPayloadV1
