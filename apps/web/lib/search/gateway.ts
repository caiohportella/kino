import { type LocaleContext, localeRegion } from '@kino/core/localization'
import {
  type PersonCandidate,
  runSearchPipelineV1,
  type SearchEntity,
  type SearchIntentEvidence,
  type SearchProviderResult,
  type SearchRequestV1,
  type SearchResponseV1,
  type SearchResultV1,
} from '@kino/core/search'

import { SearchGatewayError } from './errors.ts'
import {
  createSearchProviderStageEvent,
  publishSearchGatewayEvent,
  type SearchGatewayEventSink,
  type SearchProviderStage,
} from './observability.ts'
import { type TmdbSearchProvider, type VectorSearchProvider } from './providers/vector.ts'
import { assertSearchResultWindow } from './request.ts'

const DEFAULT_MINIMUM_VECTOR_RESULTS = 5
const DEFAULT_MINIMUM_VECTOR_SCORE = 0.55
const DEFAULT_RESULT_LIMIT = 20
const PERSON_EXPANSION_CONFIDENCE = 0.8
const DEFAULT_PROVIDER_TIMEOUT_MS = 4_500

export interface SearchGateway {
  search(request: SearchRequestV1, signal?: AbortSignal): Promise<SearchResponseV1>
}

interface CreateSearchGatewayDependencies {
  readonly vector?: VectorSearchProvider
  readonly tmdb: TmdbSearchProvider
  readonly minimumVectorResults?: number
  readonly minimumVectorScore?: number
  readonly providerTimeoutMs?: number
  readonly telemetry?: SearchGatewayEventSink
  readonly now?: () => number
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason
}

function providerSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function stageOutcome(error: unknown): 'failure' | 'timeout' {
  return error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'failure'
}

function publishStage(
  sink: SearchGatewayEventSink | undefined,
  stage: SearchProviderStage,
  outcome: 'success' | 'failure' | 'timeout' | 'skipped',
  durationMs: number,
  details: {
    readonly resultCount?: number
    readonly supplementationCount?: number
    readonly expansionOccurred?: boolean
  } = {}
): void {
  publishSearchGatewayEvent(
    sink,
    createSearchProviderStageEvent({ stage, outcome, durationMs, ...details })
  )
}

function isSufficientVectorResult(
  result: SearchProviderResult,
  minimumResults: number,
  minimumScore: number
): boolean {
  if (result.candidates.length < minimumResults) return false
  return result.candidates.some((candidate) =>
    candidate.source === 'semantic'
      ? candidate.semanticScore >= minimumScore
      : candidate.source === 'person' && candidate.confidence >= minimumScore
  )
}

function intentEvidence(sources: readonly SearchProviderResult[]): SearchIntentEvidence {
  let exactTitleConfidence: number | undefined
  let personConfidence: number | undefined
  for (const source of sources) {
    for (const candidate of source.candidates) {
      if (candidate.source === 'lexical' && candidate.exactMatch) exactTitleConfidence = 1
      if (
        candidate.source === 'person' &&
        (personConfidence === undefined || candidate.confidence > personConfidence)
      ) {
        personConfidence = candidate.confidence
      }
    }
  }
  return {
    ...(exactTitleConfidence === undefined ? {} : { exactTitleConfidence }),
    ...(personConfidence === undefined ? {} : { personConfidence }),
  }
}

function topPerson(sources: readonly SearchProviderResult[]): PersonCandidate | undefined {
  let selected: PersonCandidate | undefined
  for (const source of sources) {
    for (const candidate of source.candidates) {
      if (
        candidate.source === 'person' &&
        candidate.confidence >= PERSON_EXPANSION_CONFIDENCE &&
        (selected === undefined || candidate.confidence > selected.confidence)
      ) {
        selected = candidate
      }
    }
  }
  return selected
}

async function resolvePresentation(
  response: SearchResponseV1,
  tmdb: TmdbSearchProvider,
  context: LocaleContext | undefined,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  telemetry: SearchGatewayEventSink | undefined,
  now: () => number
): Promise<SearchResponseV1> {
  if (!context || response.results.length === 0) return response
  const startedAt = now()
  try {
    const presentedResults = await Promise.all(
      response.results.map(async (result): Promise<SearchResultV1> => {
        const entity = await tmdb.resolvePresentation(
          result.entity,
          context,
          providerSignal(signal, timeoutMs)
        )
        return { ...result, entity }
      })
    )
    publishStage(telemetry, 'tmdb_presentation', 'success', now() - startedAt, {
      resultCount: presentedResults.length,
    })
    const presentedEntities = new Map<string, SearchEntity>(
      presentedResults.map((result) => [result.entity.id, result.entity])
    )
    return {
      ...response,
      results: presentedResults,
      groups: response.groups.map((group) => ({
        ...group,
        results: group.results.map((result) => ({
          ...result,
          entity: presentedEntities.get(result.entity.id) ?? result.entity,
        })),
      })),
    }
  } catch (error) {
    throwIfCancelled(signal)
    publishStage(telemetry, 'tmdb_presentation', stageOutcome(error), now() - startedAt, {
      resultCount: 0,
    })
    throw SearchGatewayError.temporaryUnavailable()
  }
}

export function createSearchGateway(dependencies: CreateSearchGatewayDependencies): SearchGateway {
  const minimumVectorResults = dependencies.minimumVectorResults ?? DEFAULT_MINIMUM_VECTOR_RESULTS
  const minimumVectorScore = dependencies.minimumVectorScore ?? DEFAULT_MINIMUM_VECTOR_SCORE
  const providerTimeoutMs = dependencies.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS
  const now = dependencies.now ?? Date.now

  return {
    async search(request, signal): Promise<SearchResponseV1> {
      throwIfCancelled(signal)
      assertSearchResultWindow(request)
      const sources: SearchProviderResult[] = []
      let fallback: SearchResponseV1['fallback'] = 'none'
      let vectorFailed = dependencies.vector === undefined
      let vectorIsSufficient = false

      if (dependencies.vector) {
        const startedAt = now()
        try {
          const pageWindow = (request.page ?? 1) * (request.limit ?? DEFAULT_RESULT_LIMIT)
          const result = await dependencies.vector.search(
            {
              query: request.query,
              topK: Math.max(pageWindow, minimumVectorResults) * 2,
              ...(request.locale === undefined ? {} : { locale: request.locale }),
              ...(request.region === undefined ? {} : { region: request.region }),
              ...(request.mediaTypes === undefined ? {} : { mediaTypes: request.mediaTypes }),
            },
            providerSignal(signal, providerTimeoutMs)
          )
          throwIfCancelled(signal)
          sources.push(result)
          publishStage(dependencies.telemetry, 'vector', 'success', now() - startedAt, {
            resultCount: result.candidates.length,
          })
          vectorIsSufficient = isSufficientVectorResult(
            result,
            minimumVectorResults,
            minimumVectorScore
          )
        } catch (error) {
          throwIfCancelled(signal)
          publishStage(dependencies.telemetry, 'vector', stageOutcome(error), now() - startedAt, {
            resultCount: 0,
          })
          vectorFailed = true
        }
      } else {
        publishStage(dependencies.telemetry, 'vector', 'skipped', 0, { resultCount: 0 })
      }

      if (!vectorIsSufficient) {
        const startedAt = now()
        try {
          const tmdbResult = await dependencies.tmdb.search(
            {
              query: request.query,
              ...(request.locale === undefined ? {} : { locale: request.locale }),
              ...(request.region === undefined ? {} : { region: request.region }),
              ...(request.mediaTypes === undefined ? {} : { mediaTypes: request.mediaTypes }),
              page: 1,
              limit: (request.page ?? 1) * (request.limit ?? DEFAULT_RESULT_LIMIT),
            },
            providerSignal(signal, providerTimeoutMs)
          )
          throwIfCancelled(signal)
          sources.push(tmdbResult)
          publishStage(dependencies.telemetry, 'tmdb_search', 'success', now() - startedAt, {
            resultCount: tmdbResult.candidates.length,
            supplementationCount:
              sources[0]?.sourceId === 'vector' ? tmdbResult.candidates.length : 0,
          })
          fallback = vectorFailed ? 'provider_unavailable' : 'supplemented'
        } catch (error) {
          throwIfCancelled(signal)
          publishStage(
            dependencies.telemetry,
            'tmdb_search',
            stageOutcome(error),
            now() - startedAt,
            { resultCount: 0, supplementationCount: 0 }
          )
          if (sources.every((source) => source.candidates.length === 0)) {
            throw SearchGatewayError.temporaryUnavailable()
          }
          fallback = 'provider_unavailable'
        }
      } else {
        publishStage(dependencies.telemetry, 'tmdb_search', 'skipped', 0, {
          resultCount: 0,
          supplementationCount: 0,
        })
      }

      const person = topPerson(sources)
      let personExpansion:
        | {
            readonly person: PersonCandidate
            readonly credits: Awaited<ReturnType<TmdbSearchProvider['getPersonCredits']>>
          }
        | undefined
      if (person?.entity.tmdbId) {
        const startedAt = now()
        try {
          const credits = await dependencies.tmdb.getPersonCredits(
            person.entity.tmdbId,
            providerSignal(signal, providerTimeoutMs)
          )
          throwIfCancelled(signal)
          personExpansion = { person, credits }
          publishStage(dependencies.telemetry, 'person_expansion', 'success', now() - startedAt, {
            resultCount: credits.length,
            expansionOccurred: true,
          })
        } catch (error) {
          throwIfCancelled(signal)
          publishStage(
            dependencies.telemetry,
            'person_expansion',
            stageOutcome(error),
            now() - startedAt,
            { resultCount: 0, expansionOccurred: false }
          )
        }
      } else {
        publishStage(dependencies.telemetry, 'person_expansion', 'skipped', 0, {
          resultCount: 0,
          expansionOccurred: false,
        })
      }

      const response = runSearchPipelineV1({
        request,
        intentEvidence: intentEvidence(sources),
        sources,
        ...(personExpansion === undefined ? {} : { personExpansion }),
        fallback,
      })
      return resolvePresentation(
        response,
        dependencies.tmdb,
        request.locale
          ? {
              locale: request.locale,
              region: request.region ?? localeRegion(request.locale) ?? 'US',
            }
          : undefined,
        signal,
        providerTimeoutMs,
        dependencies.telemetry,
        now
      )
    },
  }
}
