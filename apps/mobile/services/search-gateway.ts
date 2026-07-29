import { isSearchResponseV1, type SearchRequestV1, type SearchResponseV1 } from '@kino/core/search'

export interface SearchGateway {
  search(input: SearchRequestV1, signal?: AbortSignal): Promise<SearchResponseV1>
}

export class SearchGatewayClientError extends Error {
  readonly code: string
  readonly status?: number

  constructor(code: string, message = 'Search is temporarily unavailable.', status?: number) {
    super(message)
    this.name = 'SearchGatewayClientError'
    this.code = code
    this.status = status
  }
}

export function createSearchGateway(options: {
  origin: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}): SearchGateway {
  const request = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 8_000
  return {
    async search(input, signal) {
      if (signal?.aborted) throw abortError()
      const controller = new AbortController()
      const onAbort = () => controller.abort()
      signal?.addEventListener('abort', onAbort, { once: true })
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await request(`${options.origin}/api/v1/search`, {
          body: JSON.stringify(input),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        })
        let body: unknown
        try {
          body = await response.json()
        } catch {
          throw new SearchGatewayClientError(
            response.ok ? 'invalid_response' : 'http_error',
            'Search returned an unreadable response.',
            response.status
          )
        }
        if (!response.ok) throw gatewayError(body, response.status)
        if (!isSearchResponseV1(body)) {
          throw new SearchGatewayClientError(
            'invalid_response',
            'Search returned an invalid response.'
          )
        }
        return body as SearchResponseV1
      } catch (error) {
        if (signal?.aborted) throw abortError()
        if (controller.signal.aborted) {
          throw new SearchGatewayClientError('timeout', 'Search request timed out.')
        }
        if (error instanceof SearchGatewayClientError) throw error
        throw new SearchGatewayClientError('network_error', 'Search request failed.')
      } finally {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
      }
    },
  }
}

function gatewayError(body: unknown, status: number) {
  const error =
    body &&
    typeof body === 'object' &&
    'error' in body &&
    body.error &&
    typeof body.error === 'object'
      ? body.error
      : null
  const code =
    error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'temporary_unavailable'
  return new SearchGatewayClientError(code, 'Search is temporarily unavailable.', status)
}

function abortError() {
  const error = new Error('Search request was cancelled.')
  error.name = 'AbortError'
  return error
}
