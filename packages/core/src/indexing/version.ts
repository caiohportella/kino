import type { SearchIndexDocumentV1, UnversionedSearchIndexDocumentV1 } from './types.ts'

export const SEARCH_INDEX_SCHEMA_VERSION = 1 as const

export type SearchIndexSchemaVersion = typeof SEARCH_INDEX_SCHEMA_VERSION

export const versionSearchIndexDocumentV1 = (
  document: UnversionedSearchIndexDocumentV1
): SearchIndexDocumentV1 =>
  ({
    ...document,
    indexVersion: SEARCH_INDEX_SCHEMA_VERSION,
  }) as SearchIndexDocumentV1
