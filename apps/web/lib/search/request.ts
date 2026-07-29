import { normalizeLocale, normalizeRegion } from '@kino/core/localization'
import {
  SEARCH_SCHEMA_VERSION,
  type SearchMediaType,
  type SearchRequestV1,
} from '@kino/core/search'

import { SearchGatewayError } from './errors.ts'

const MAX_QUERY_CODE_POINTS = 200
const MAX_PAGE = 100
const MAX_LIMIT = 50
const MAX_RESULT_WINDOW = 100
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MEDIA_TYPES = new Set<SearchMediaType>(['movie', 'series'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeQuery(value: unknown): string {
  if (typeof value !== 'string') throw SearchGatewayError.invalidRequest('query')
  const query = value.trim().replace(/\s+/gu, ' ')
  if (query.length === 0 || [...query].length > MAX_QUERY_CODE_POINTS) {
    throw SearchGatewayError.invalidRequest('query')
  }
  return query
}

function optionalLocale(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw SearchGatewayError.invalidRequest('locale')
  try {
    return normalizeLocale(value)
  } catch {
    throw SearchGatewayError.invalidRequest('locale')
  }
}

function optionalRegion(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw SearchGatewayError.invalidRequest('region')
  try {
    return normalizeRegion(value)
  } catch {
    throw SearchGatewayError.invalidRequest('region')
  }
}

function optionalMediaTypes(value: unknown): readonly SearchMediaType[] | undefined {
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((mediaType) => !isSearchMediaType(mediaType))
  ) {
    throw SearchGatewayError.invalidRequest('mediaTypes')
  }
  return [...new Set(value as SearchMediaType[])]
}

function isSearchMediaType(value: unknown): value is SearchMediaType {
  return typeof value === 'string' && MEDIA_TYPES.has(value as SearchMediaType)
}

function optionalBoundedInteger(
  value: unknown,
  field: 'page' | 'limit',
  maximum: number
): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > maximum) {
    throw SearchGatewayError.invalidRequest(field)
  }
  return value
}

export function assertSearchResultWindow(request: Pick<SearchRequestV1, 'page' | 'limit'>): void {
  if ((request.page ?? DEFAULT_PAGE) * (request.limit ?? DEFAULT_LIMIT) > MAX_RESULT_WINDOW) {
    throw SearchGatewayError.invalidRequest('page')
  }
}

export function parseSearchRequestV1(json: unknown): SearchRequestV1 {
  if (!isRecord(json)) throw SearchGatewayError.invalidRequest('body')
  if (json.schemaVersion !== SEARCH_SCHEMA_VERSION) throw SearchGatewayError.unsupportedVersion()

  const query = normalizeQuery(json.query)
  const locale = optionalLocale(json.locale)
  const region = optionalRegion(json.region)
  const mediaTypes = optionalMediaTypes(json.mediaTypes)
  const page = optionalBoundedInteger(json.page, 'page', MAX_PAGE)
  const limit = optionalBoundedInteger(json.limit, 'limit', MAX_LIMIT)
  assertSearchResultWindow({ page, limit })

  return {
    schemaVersion: SEARCH_SCHEMA_VERSION,
    query,
    ...(locale === undefined ? {} : { locale }),
    ...(region === undefined ? {} : { region }),
    ...(mediaTypes === undefined ? {} : { mediaTypes }),
    ...(page === undefined ? {} : { page }),
    ...(limit === undefined ? {} : { limit }),
  }
}
