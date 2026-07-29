import type { LocaleContext } from '@kino/core/localization'
import type {
  PersonCredit,
  SearchEntity,
  SearchMediaType,
  SearchProviderResult,
  SearchRequestV1,
} from '@kino/core/search'

export interface VectorSearchRequest {
  readonly query: string
  readonly topK: number
  readonly locale?: string
  readonly region?: string
  readonly mediaTypes?: readonly SearchMediaType[]
}

export interface VectorSearchProvider {
  search(request: VectorSearchRequest, signal?: AbortSignal): Promise<SearchProviderResult>
}

export type TmdbSearchRequest = Omit<SearchRequestV1, 'schemaVersion'>

export interface TmdbSearchProvider {
  search(request: TmdbSearchRequest, signal?: AbortSignal): Promise<SearchProviderResult>
  getPersonCredits(personId: number, signal?: AbortSignal): Promise<readonly PersonCredit[]>
  resolvePresentation(
    entity: SearchEntity,
    context: LocaleContext,
    signal?: AbortSignal
  ): Promise<SearchEntity>
}

export type SearchProviderBoundaryErrorCode = 'provider_unavailable' | 'provider_response_invalid'

export class SearchProviderBoundaryError extends Error {
  readonly code: SearchProviderBoundaryErrorCode

  constructor(code: SearchProviderBoundaryErrorCode) {
    super(
      code === 'provider_response_invalid'
        ? 'Search provider returned an invalid response'
        : 'Search provider is temporarily unavailable'
    )
    this.name = 'SearchProviderBoundaryError'
    this.code = code
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}
