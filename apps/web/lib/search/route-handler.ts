import type { SearchResponseV1 } from '@kino/core/search'

import { SearchGatewayError } from './errors.ts'
import type { SearchGateway } from './gateway.ts'
import {
  createSearchGatewayEvent,
  fingerprintSearchQuery,
  publishSearchGatewayEvent,
  type SearchGatewayEventSink,
} from './observability.ts'
import { isAbortError } from './providers/vector.ts'
import type { SearchRateLimiter } from './rate-limit.ts'
import { parseSearchRequestV1 } from './request.ts'

interface CreateSearchRouteHandlerDependencies {
  readonly gateway: SearchGateway
  readonly rateLimiter?: SearchRateLimiter
  readonly clientKey?: (request: Request) => string
  readonly traceId?: () => string
  readonly eventSink?: SearchGatewayEventSink
  readonly now?: () => number
}

function json(
  body: unknown,
  status: number,
  traceId: string,
  headers?: Record<string, string>
): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-request-id': traceId,
      ...headers,
    },
  })
}

export function createSearchRouteHandler({
  gateway,
  rateLimiter,
  clientKey = () => 'anonymous',
  traceId: createTraceId = () => globalThis.crypto.randomUUID(),
  eventSink,
  now = Date.now,
}: CreateSearchRouteHandlerDependencies): (request: Request) => Promise<Response> {
  return async (request): Promise<Response> => {
    const traceId = createTraceId()
    const startedAt = now()
    if (rateLimiter) {
      try {
        const decision = await rateLimiter.check(clientKey(request), request.signal)
        if (!decision.allowed) {
          const retryAfterSeconds = decision.retryAfterSeconds ?? 1
          publishSearchGatewayEvent(
            eventSink,
            createSearchGatewayEvent({
              traceId,
              outcome: 'rate_limited',
              durationMs: now() - startedAt,
              cancelled: false,
              providerFailure: false,
              rateLimited: true,
            })
          )
          const error = SearchGatewayError.rateLimited(retryAfterSeconds)
          return json(error.body, error.status, traceId, {
            'retry-after': String(retryAfterSeconds),
          })
        }
      } catch (error) {
        if (request.signal.aborted || isAbortError(error)) throw error
      }
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      publishSearchGatewayEvent(
        eventSink,
        createSearchGatewayEvent({
          traceId,
          outcome: 'invalid_request',
          durationMs: now() - startedAt,
          cancelled: false,
          providerFailure: false,
          rateLimited: false,
        })
      )
      return json(SearchGatewayError.invalidRequest('body').body, 400, traceId)
    }

    try {
      const parsed = parseSearchRequestV1(body)
      const queryFingerprint = await fingerprintSearchQuery(parsed.query)
      const response: SearchResponseV1 = await gateway.search(parsed, request.signal)
      publishSearchGatewayEvent(
        eventSink,
        createSearchGatewayEvent({
          traceId,
          schemaVersion: parsed.schemaVersion,
          queryFingerprint,
          outcome: 'success',
          fallback: response.fallback,
          resultCount: response.total,
          durationMs: now() - startedAt,
          cancelled: false,
          providerFailure: response.fallback === 'provider_unavailable',
          rateLimited: false,
        })
      )
      return json(response, 200, traceId)
    } catch (error) {
      if (request.signal.aborted || isAbortError(error)) {
        publishSearchGatewayEvent(
          eventSink,
          createSearchGatewayEvent({
            traceId,
            outcome: 'cancelled',
            durationMs: now() - startedAt,
            cancelled: true,
            providerFailure: false,
            rateLimited: false,
          })
        )
        throw error
      }
      const gatewayError =
        error instanceof SearchGatewayError ? error : SearchGatewayError.temporaryUnavailable()
      publishSearchGatewayEvent(
        eventSink,
        createSearchGatewayEvent({
          traceId,
          outcome:
            gatewayError.body.error.code === 'invalid_request' ||
            gatewayError.body.error.code === 'unsupported_version'
              ? 'invalid_request'
              : 'failure',
          durationMs: now() - startedAt,
          cancelled: false,
          providerFailure: gatewayError.body.error.code === 'temporary_unavailable',
          rateLimited: false,
        })
      )
      return json(gatewayError.body, gatewayError.status, traceId)
    }
  }
}
