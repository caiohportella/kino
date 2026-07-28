import type { SearchResponseV1 } from '@kino/core/search'

import { SearchGatewayError } from './errors.ts'
import type { SearchGateway } from './gateway.ts'
import { isAbortError } from './providers/vector.ts'
import { parseSearchRequestV1 } from './request.ts'

interface CreateSearchRouteHandlerDependencies {
  readonly gateway: SearchGateway
}

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

export function createSearchRouteHandler({
  gateway,
}: CreateSearchRouteHandlerDependencies): (request: Request) => Promise<Response> {
  return async (request): Promise<Response> => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json(SearchGatewayError.invalidRequest('body').body, 400)
    }

    try {
      const parsed = parseSearchRequestV1(body)
      const response: SearchResponseV1 = await gateway.search(parsed, request.signal)
      return json(response, 200)
    } catch (error) {
      if (request.signal.aborted || isAbortError(error)) throw error
      const gatewayError =
        error instanceof SearchGatewayError ? error : SearchGatewayError.temporaryUnavailable()
      return json(gatewayError.body, gatewayError.status)
    }
  }
}
