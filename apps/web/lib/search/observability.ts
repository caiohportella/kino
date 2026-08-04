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

export type SearchProviderStage =
  | 'vector'
  | 'tmdb_search'
  | 'person_expansion'
  | 'tmdb_presentation'

export interface SearchProviderStageEvent {
  readonly type: 'search_gateway_provider_stage'
  readonly stage: SearchProviderStage
  readonly outcome: 'success' | 'failure' | 'timeout' | 'skipped'
  readonly durationMs: number
  readonly resultCount?: number
  readonly supplementationCount?: number
  readonly expansionOccurred?: boolean
}

export type SearchTelemetryEvent = SearchGatewayEvent | SearchProviderStageEvent

export interface SearchGatewayEventSink {
  emit(event: SearchTelemetryEvent): void | Promise<void>
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

export function createSearchProviderStageEvent(
  input: Omit<SearchProviderStageEvent, 'type' | 'durationMs'> & {
    readonly durationMs: number
    readonly [ignored: string]: unknown
  }
): SearchProviderStageEvent {
  return {
    type: 'search_gateway_provider_stage',
    stage: input.stage,
    outcome: input.outcome,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    ...(input.resultCount === undefined ? {} : { resultCount: Math.max(0, input.resultCount) }),
    ...(input.supplementationCount === undefined
      ? {}
      : { supplementationCount: Math.max(0, input.supplementationCount) }),
    ...(input.expansionOccurred === undefined
      ? {}
      : { expansionOccurred: input.expansionOccurred }),
  }
}

export function publishSearchGatewayEvent(
  sink: SearchGatewayEventSink | undefined,
  event: SearchTelemetryEvent
): void {
  if (!sink) return
  try {
    Promise.resolve(sink.emit(event)).catch(() => undefined)
  } catch {
    // Metrics and logging are never part of the request's success path.
  }
}
