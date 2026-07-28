import { normalizeSearchQuery, type SearchResponseV1 } from '@kino/core/search'

export type SearchGatewayEventOutcome =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'rate_limited'
  | 'invalid_request'

export interface SearchGatewayEvent {
  readonly type: 'search_gateway_request'
  readonly traceId: string
  readonly schemaVersion?: number
  readonly queryFingerprint?: string
  readonly outcome: SearchGatewayEventOutcome
  readonly fallback?: SearchResponseV1['fallback']
  readonly resultCount?: number
  readonly durationMs: number
  readonly cancelled: boolean
  readonly providerFailure: boolean
  readonly rateLimited: boolean
}

export interface SearchGatewayEventSink {
  emit(event: SearchGatewayEvent): void | Promise<void>
}

interface CreateSearchGatewayEventInput {
  readonly traceId: string
  readonly schemaVersion?: number
  readonly queryFingerprint?: string
  readonly outcome: SearchGatewayEventOutcome
  readonly fallback?: SearchResponseV1['fallback']
  readonly resultCount?: number
  readonly durationMs: number
  readonly cancelled: boolean
  readonly providerFailure: boolean
  readonly rateLimited: boolean
  readonly [ignored: string]: unknown
}

export async function fingerprintSearchQuery(query: string): Promise<string> {
  const normalized = normalizeSearchQuery(query).folded
  const bytes = new TextEncoder().encode(normalized)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createSearchGatewayEvent(input: CreateSearchGatewayEventInput): SearchGatewayEvent {
  return {
    type: 'search_gateway_request',
    traceId: input.traceId,
    ...(input.schemaVersion === undefined ? {} : { schemaVersion: input.schemaVersion }),
    ...(input.queryFingerprint === undefined ? {} : { queryFingerprint: input.queryFingerprint }),
    outcome: input.outcome,
    ...(input.fallback === undefined ? {} : { fallback: input.fallback }),
    ...(input.resultCount === undefined ? {} : { resultCount: input.resultCount }),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    cancelled: input.cancelled,
    providerFailure: input.providerFailure,
    rateLimited: input.rateLimited,
  }
}

export function publishSearchGatewayEvent(
  sink: SearchGatewayEventSink | undefined,
  event: SearchGatewayEvent
): void {
  if (!sink) return
  try {
    Promise.resolve(sink.emit(event)).catch(() => undefined)
  } catch {
    // Metrics and logging are never part of the request's success path.
  }
}
