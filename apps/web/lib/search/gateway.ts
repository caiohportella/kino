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
  isAbortError,
  type TmdbSearchProvider,
  type VectorSearchProvider,
} from './providers/vector.ts'

const DEFAULT_MINIMUM_VECTOR_RESULTS = 5
const DEFAULT_MINIMUM_VECTOR_SCORE = 0.55
const MAX_PROVIDER_RESULTS = 50
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
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason
}

function providerSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function isSufficientVectorResult(
  result: SearchProviderResult,
  minimumResults: number,
  minimumScore: number
): boolean {
  if (result.candidates.length < minimumResults) return false
  return result.candidates.some(
    (candidate) => candidate.source === 'semantic' && candidate.semanticScore >= minimumScore
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
  timeoutMs: number
): Promise<SearchResponseV1> {
  if (!context || response.results.length === 0) return response
  const presentedResults = await Promise.all(
    response.results.map(async (result): Promise<SearchResultV1> => {
      try {
        const entity = await tmdb.resolvePresentation(
          result.entity,
          context,
          providerSignal(signal, timeoutMs)
        )
        return { ...result, entity }
      } catch (error) {
        throwIfCancelled(signal)
        if (isAbortError(error)) return result
        return result
      }
    })
  )
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
}

export function createSearchGateway(dependencies: CreateSearchGatewayDependencies): SearchGateway {
  const minimumVectorResults = dependencies.minimumVectorResults ?? DEFAULT_MINIMUM_VECTOR_RESULTS
  const minimumVectorScore = dependencies.minimumVectorScore ?? DEFAULT_MINIMUM_VECTOR_SCORE
  const providerTimeoutMs = dependencies.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS

  return {
    async search(request, signal): Promise<SearchResponseV1> {
      throwIfCancelled(signal)
      const sources: SearchProviderResult[] = []
      let fallback: SearchResponseV1['fallback'] = 'none'
      let vectorFailed = dependencies.vector === undefined
      let vectorIsSufficient = false

      if (dependencies.vector) {
        try {
          const result = await dependencies.vector.search(
            {
              query: request.query,
              topK: Math.min(
                MAX_PROVIDER_RESULTS,
                Math.max(request.limit ?? DEFAULT_RESULT_LIMIT, minimumVectorResults) * 2
              ),
              ...(request.locale === undefined ? {} : { locale: request.locale }),
              ...(request.region === undefined ? {} : { region: request.region }),
              ...(request.mediaTypes === undefined ? {} : { mediaTypes: request.mediaTypes }),
            },
            providerSignal(signal, providerTimeoutMs)
          )
          throwIfCancelled(signal)
          sources.push(result)
          vectorIsSufficient = isSufficientVectorResult(
            result,
            minimumVectorResults,
            minimumVectorScore
          )
        } catch {
          throwIfCancelled(signal)
          vectorFailed = true
        }
      }

      if (!vectorIsSufficient) {
        try {
          const tmdbResult = await dependencies.tmdb.search(
            {
              query: request.query,
              ...(request.locale === undefined ? {} : { locale: request.locale }),
              ...(request.region === undefined ? {} : { region: request.region }),
              ...(request.mediaTypes === undefined ? {} : { mediaTypes: request.mediaTypes }),
              ...(request.page === undefined ? {} : { page: request.page }),
            },
            providerSignal(signal, providerTimeoutMs)
          )
          throwIfCancelled(signal)
          sources.push(tmdbResult)
          fallback = vectorFailed ? 'provider_unavailable' : 'supplemented'
        } catch {
          throwIfCancelled(signal)
          if (sources.every((source) => source.candidates.length === 0)) {
            throw SearchGatewayError.temporaryUnavailable()
          }
          fallback = 'provider_unavailable'
        }
      }

      const person = topPerson(sources)
      let personExpansion:
        | {
            readonly person: PersonCandidate
            readonly credits: Awaited<ReturnType<TmdbSearchProvider['getPersonCredits']>>
          }
        | undefined
      if (person?.entity.tmdbId) {
        try {
          const credits = await dependencies.tmdb.getPersonCredits(
            person.entity.tmdbId,
            providerSignal(signal, providerTimeoutMs)
          )
          throwIfCancelled(signal)
          personExpansion = { person, credits }
        } catch {
          throwIfCancelled(signal)
        }
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
        providerTimeoutMs
      )
    },
  }
}
