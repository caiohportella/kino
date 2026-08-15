import { type LocaleContext, localeRegion } from '@kino/core/localization'
import {
  detectSearchIntent,
  normalizeSearchQuery,
  type PersonCandidate,
  qualifyPersonExpansion,
  runSearchPipelineV1,
  runSearchPipelineV2,
  type SearchEntity,
  type SearchIntentEvidence,
  type SearchProviderResult,
  type SearchRequest,
  type SearchRequestV1,
  type SearchResponse,
  type SearchResponseV1,
  type SearchResultV1,
  type SearchResultV2,
} from '@kino/core/search'

import { SearchGatewayError } from './errors.ts'
import {
  createSearchProviderStageEvent,
  publishSearchGatewayEvent,
  type SearchGatewayEventSink,
  type SearchProviderStage,
} from './observability.ts'
import {
  PERSON_RELATIONSHIP_MAX_CREDITS,
  PERSON_RELATIONSHIP_SCHEMA_VERSION,
  type PersonRelationshipRecord,
} from './person-relationships.ts'
import type { PersonRelationshipCache } from './providers/person-relationship-cache.ts'
import { type TmdbSearchProvider, type VectorSearchProvider } from './providers/vector.ts'
import { assertSearchResultWindow } from './request.ts'
import type { PersonIndexer } from './upstash/person-indexer.ts'
import { personDocumentsFromSearchResponse } from './upstash/person-indexer.ts'
import type { TitleIndexer } from './upstash/title-indexer.ts'
import { titleDocumentsFromSearchResponse } from './upstash/title-indexer.ts'
import type { UserSearchProvider } from './upstash/user-search-provider.ts'

const DEFAULT_MINIMUM_VECTOR_RESULTS = 5
const DEFAULT_MINIMUM_VECTOR_SCORE = 0.55
const DEFAULT_RESULT_LIMIT = 20
const DEFAULT_PROVIDER_TIMEOUT_MS = 4_500
const AUTOCOMPLETE_PROVIDER_TIMEOUT_MS = 800
const AUTOCOMPLETE_MINIMUM_VECTOR_RESULTS = 2

export interface SearchGateway {
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResponse>
}

interface CreateSearchGatewayDependencies {
  readonly vector?: VectorSearchProvider
  readonly users?: UserSearchProvider
  readonly titleIndexer?: TitleIndexer
  readonly personIndexer?: PersonIndexer
  readonly tmdb: TmdbSearchProvider
  readonly minimumVectorResults?: number
  readonly minimumVectorScore?: number
  readonly providerTimeoutMs?: number
  readonly autocompleteProviderTimeoutMs?: number
  readonly telemetry?: SearchGatewayEventSink
  readonly relationships?: PersonRelationshipCache
  readonly now?: () => number
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason
}

function providerSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function userSearchResultV2(result: SearchResultV1): SearchResultV2 {
  return {
    entity: result.entity,
    score: {
      relationshipScore: 0,
      semanticScore: Math.max(0, Math.min(1, result.score)),
      popularityScore: Math.max(0, Math.min(1, result.score)),
      voteConfidenceScore: 0.5,
      castOrderScore: 0,
    },
    sources: result.sources,
    ...(result.relationship === undefined ? {} : { relationship: result.relationship }),
  }
}

function appendUserResults(
  response: SearchResponse,
  userResults: readonly SearchResultV1[],
  page: number,
  limit: number
): SearchResponse {
  if (userResults.length === 0) return response
  const start = (page - 1) * limit
  const end = start + limit
  const pagedUsers = userResults.slice(start, end)
  if (pagedUsers.length === 0) return response
  if (response.schemaVersion === 1) {
    const group = { type: 'users' as const, results: pagedUsers }
    const groups = [...response.groups, group]
    return {
      ...response,
      results: [...response.results, ...pagedUsers],
      groups,
      total: response.total + userResults.length,
      ...(userResults.length > end ? { nextPage: response.nextPage ?? page + 1 } : {}),
    }
  }
  const pagedUsersV2 = pagedUsers.map(userSearchResultV2)
  const group = { type: 'users' as const, results: pagedUsersV2 }
  const groups = [...response.groups, group]
  return {
    ...response,
    results: [...response.results, ...pagedUsersV2],
    groups,
    total: response.total + userResults.length,
    ...(userResults.length > end ? { nextPage: response.nextPage ?? page + 1 } : {}),
  }
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
  const uniqueEntities = new Set(result.candidates.map((candidate) => candidate.entity.id))
  const strongLexical = result.candidates.some(
    (candidate) =>
      candidate.source === 'lexical' &&
      (candidate.exactMatch || candidate.prefixMatch || candidate.lexicalScore >= minimumScore)
  )
  const strongSemantic = result.candidates.some((candidate) =>
    candidate.source === 'semantic'
      ? candidate.semanticScore >= minimumScore
      : candidate.source === 'person' && candidate.confidence >= minimumScore
  )
  return strongLexical || (uniqueEntities.size >= minimumResults && strongSemantic)
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
        (selected === undefined || candidate.confidence > selected.confidence)
      ) {
        selected = candidate
      }
    }
  }
  return selected
}

function qualifiedTopPerson(
  request: SearchRequest,
  sources: readonly SearchProviderResult[]
): PersonCandidate | undefined {
  const person = topPerson(sources)
  if (!person) return undefined
  const query = normalizeSearchQuery(request.query)
  const intent = detectSearchIntent(query, intentEvidence(sources))
  return qualifyPersonExpansion(query, { intent, person }) ? person : undefined
}

function relationshipRecord(
  person: PersonCandidate,
  credits: Awaited<ReturnType<TmdbSearchProvider['getPersonCredits']>>,
  updatedAt: string
): PersonRelationshipRecord {
  const boundedCredits = credits.slice(0, PERSON_RELATIONSHIP_MAX_CREDITS)
  return {
    schemaVersion: PERSON_RELATIONSHIP_SCHEMA_VERSION,
    personId: person.entity.tmdbId!,
    aliases: [person.entity.title],
    knownForDepartment: null,
    movieCredits: boundedCredits.filter((credit) => credit.entity.entityType === 'movie'),
    tvCredits: boundedCredits.filter((credit) => credit.entity.entityType === 'series'),
    complete: true,
    updatedAt,
  }
}

async function resolvePresentation(
  response: SearchResponse,
  tmdb: TmdbSearchProvider,
  context: LocaleContext | undefined,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  telemetry: SearchGatewayEventSink | undefined,
  now: () => number,
  bestEffort = false
): Promise<SearchResponse> {
  if (!context || response.results.length === 0) return response
  const startedAt = now()
  try {
    const presentedResults = await Promise.all(
      response.results.map(async (result): Promise<SearchResultV1 | SearchResultV2> => {
        try {
          const entity = await tmdb.resolvePresentation(
            result.entity,
            context,
            providerSignal(signal, timeoutMs)
          )
          return { ...result, entity }
        } catch (error) {
          throwIfCancelled(signal)
          if (!bestEffort) throw error
          return result
        }
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
    } as SearchResponse
  } catch (error) {
    throwIfCancelled(signal)
    publishStage(telemetry, 'tmdb_presentation', stageOutcome(error), now() - startedAt, {
      resultCount: 0,
    })
    throw SearchGatewayError.temporaryUnavailable()
  }
}

export function createSearchGateway(dependencies: CreateSearchGatewayDependencies): SearchGateway {
  const vector = dependencies.vector
  const users = dependencies.users
  const minimumVectorResults = dependencies.minimumVectorResults ?? DEFAULT_MINIMUM_VECTOR_RESULTS
  const minimumVectorScore = dependencies.minimumVectorScore ?? DEFAULT_MINIMUM_VECTOR_SCORE
  const providerTimeoutMs = dependencies.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS
  const autocompleteProviderTimeoutMs =
    dependencies.autocompleteProviderTimeoutMs ?? AUTOCOMPLETE_PROVIDER_TIMEOUT_MS
  const now = dependencies.now ?? Date.now

  return {
    async search(request, signal): Promise<SearchResponse> {
      throwIfCancelled(signal)
      assertSearchResultWindow(request)
      const autocomplete = request.mode === 'autocomplete'
      const requestTimeoutMs = autocomplete ? autocompleteProviderTimeoutMs : providerTimeoutMs
      const vectorMinimumResults = autocomplete
        ? AUTOCOMPLETE_MINIMUM_VECTOR_RESULTS
        : minimumVectorResults
      const sources: SearchProviderResult[] = []
      let fallback: SearchResponseV1['fallback'] = 'none'
      let vectorFailed = vector === undefined
      let vectorIsSufficient = false
      let userResults: readonly SearchResultV1[] = []
      let vectorTask: Promise<SearchProviderResult | null>
      if (vector) {
        vectorTask = (async (): Promise<SearchProviderResult | null> => {
          const startedAt = now()
          try {
            const pageWindow = (request.page ?? 1) * (request.limit ?? DEFAULT_RESULT_LIMIT)
            const result = await vector.search(
              {
                query: request.query,
                topK: Math.max(pageWindow, vectorMinimumResults) * 2,
                ...(request.locale === undefined ? {} : { locale: request.locale }),
                ...(request.region === undefined ? {} : { region: request.region }),
                ...(request.mediaTypes === undefined ? {} : { mediaTypes: request.mediaTypes }),
              },
              providerSignal(signal, requestTimeoutMs)
            )
            throwIfCancelled(signal)
            publishStage(dependencies.telemetry, 'vector', 'success', now() - startedAt, {
              resultCount: result.candidates.length,
            })
            vectorIsSufficient = isSufficientVectorResult(
              result,
              vectorMinimumResults,
              minimumVectorScore
            )
            return result
          } catch (error) {
            throwIfCancelled(signal)
            publishStage(dependencies.telemetry, 'vector', stageOutcome(error), now() - startedAt, {
              resultCount: 0,
            })
            vectorFailed = true
            return null
          }
        })()
      } else {
        publishStage(dependencies.telemetry, 'vector', 'skipped', 0, {
          resultCount: 0,
        })
        vectorTask = Promise.resolve(null)
      }

      const userTask = users
        ? (async (): Promise<readonly SearchResultV1[]> => {
            const startedAt = now()
            try {
              const userSearch = await users.search(
                {
                  query: request.query,
                  limit: request.limit ?? DEFAULT_RESULT_LIMIT,
                },
                providerSignal(signal, requestTimeoutMs)
              )
              throwIfCancelled(signal)
              publishStage(dependencies.telemetry, 'user_search', 'success', now() - startedAt, {
                resultCount: userSearch.results.length,
              })
              return userSearch.results
            } catch (error) {
              throwIfCancelled(signal)
              publishStage(
                dependencies.telemetry,
                'user_search',
                stageOutcome(error),
                now() - startedAt,
                { resultCount: 0 }
              )
              return []
            }
          })()
        : Promise.resolve([])

      const vectorResult = await vectorTask
      if (vectorResult) sources.push(vectorResult)
      userResults = await userTask

      if (!vectorIsSufficient) {
        const startedAt = now()
        try {
          const tmdbResult = await dependencies.tmdb.search(
            {
              query: request.query,
              ...(request.locale === undefined ? {} : { locale: request.locale }),
              ...(request.region === undefined ? {} : { region: request.region }),
              ...(request.mediaTypes === undefined ? {} : { mediaTypes: request.mediaTypes }),
              ...(autocomplete ? { mode: 'autocomplete' as const } : { mode: 'full' as const }),
              page: 1,
              limit: (request.page ?? 1) * (request.limit ?? DEFAULT_RESULT_LIMIT),
            },
            providerSignal(signal, requestTimeoutMs)
          )
          throwIfCancelled(signal)
          sources.push(tmdbResult)
          publishStage(dependencies.telemetry, 'tmdb_search', 'success', now() - startedAt, {
            resultCount: tmdbResult.candidates.length,
            supplementationCount: sources.length > 1 ? tmdbResult.candidates.length : 0,
          })
          if (!autocomplete && dependencies.titleIndexer) {
            void dependencies.titleIndexer
              .upsertDocument(titleDocumentsFromSearchResponse(tmdbResult))
              .catch(() => undefined)
          }
          if (!autocomplete && dependencies.personIndexer) {
            void dependencies.personIndexer
              .upsertDocument(personDocumentsFromSearchResponse(tmdbResult))
              .catch(() => undefined)
          }
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

      const person = autocomplete ? undefined : qualifiedTopPerson(request, sources)
      let personExpansion:
        | {
            readonly person: PersonCandidate
            readonly credits: Awaited<ReturnType<TmdbSearchProvider['getPersonCredits']>>
          }
        | undefined
      if (!autocomplete && person?.entity.tmdbId) {
        const startedAt = now()
        try {
          const cached = dependencies.relationships
            ? await dependencies.relationships.get(person.entity.tmdbId)
            : { state: 'missing' as const }
          let credits: Awaited<ReturnType<TmdbSearchProvider['getPersonCredits']>>
          if (cached.state === 'fresh_complete' || cached.state === 'stale_complete') {
            credits = [...cached.record.movieCredits, ...cached.record.tvCredits]
          } else {
            credits = await dependencies.tmdb.getPersonCredits(
              person.entity.tmdbId,
              providerSignal(signal, providerTimeoutMs)
            )
            if (dependencies.relationships) {
              const record = relationshipRecord(person, credits, new Date(now()).toISOString())
              try {
                await dependencies.relationships.set(record)
              } catch {
                // Cache writes are not part of the search success path.
              }
            }
          }
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

      const pipelineInput = {
        request,
        intentEvidence: intentEvidence(sources),
        sources,
        ...(personExpansion === undefined ? {} : { personExpansion }),
        fallback,
      }
      const response =
        request.schemaVersion === 2
          ? runSearchPipelineV2({ ...pipelineInput, request })
          : runSearchPipelineV1({ ...pipelineInput, request })
      const withUsers = appendUserResults(
        response,
        userResults,
        request.page ?? 1,
        request.limit ?? DEFAULT_RESULT_LIMIT
      )
      return resolvePresentation(
        withUsers,
        dependencies.tmdb,
        request.locale
          ? {
              locale: request.locale,
              region: request.region ?? localeRegion(request.locale) ?? 'US',
            }
          : undefined,
        signal,
        autocomplete ? autocompleteProviderTimeoutMs : providerTimeoutMs,
        dependencies.telemetry,
        now,
        autocomplete
      )
    },
  }
}
