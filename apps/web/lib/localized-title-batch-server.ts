import {
  LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
  type LocalizedTitleBatchInput,
  type LocalizedTitleBatchItem,
  type LocalizedTitleBatchResponse,
  type ResolvedLocalizedTitleSummary,
  selectLocalizedImage,
} from '@kino/core/localization'

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const DEFAULT_CONCURRENCY = 6
const MAX_CACHE_ENTRIES = 2_000

export interface LocalizedTitleProviderResult {
  readonly backdropPath: string | null
  readonly defaultPosterPath: string | null
  readonly originalLanguage: string | null
  readonly posters: readonly {
    readonly aspect_ratio?: number | null
    readonly file_path: string | null
    readonly height?: number | null
    readonly iso_639_1: string | null
    readonly vote_average?: number | null
    readonly vote_count?: number | null
    readonly width?: number | null
  }[]
  readonly title: string
  readonly year: number | null
}

interface CacheEntry {
  readonly expiresAt: number
  readonly summary: ResolvedLocalizedTitleSummary
}

interface ServiceOptions {
  readonly cache?: Map<string, CacheEntry>
  readonly cacheTtlMs?: number
  readonly concurrency?: number
  readonly fetchTitle: (
    item: LocalizedTitleBatchItem,
    input: Pick<LocalizedTitleBatchInput, 'locale' | 'region'>,
    signal?: AbortSignal
  ) => Promise<LocalizedTitleProviderResult>
  readonly now?: () => number
}

export function createLocalizedTitleBatchService(options: ServiceOptions) {
  const cache = options.cache ?? new Map<string, CacheEntry>()
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY))
  const now = options.now ?? Date.now

  return {
    async resolve(
      input: LocalizedTitleBatchInput,
      signal?: AbortSignal
    ): Promise<LocalizedTitleBatchResponse> {
      const summaries: Array<ResolvedLocalizedTitleSummary | undefined> = new Array(
        input.items.length
      )
      const missing: LocalizedTitleBatchItem[] = []
      const errors: LocalizedTitleBatchItem[] = []
      const work: Array<{ index: number; item: LocalizedTitleBatchItem }> = []
      const seen = new Set<string>()

      input.items.forEach((item, index) => {
        const key = cacheKey(item, input)
        if (seen.has(key)) return
        seen.add(key)
        const cached = cache.get(key)
        if (cached && cached.expiresAt > now()) {
          summaries[index] = cached.summary
          return
        }
        if (cached) cache.delete(key)
        work.push({ index, item })
      })

      let cursor = 0
      await Promise.all(
        Array.from({ length: Math.min(concurrency, work.length) }, async () => {
          while (cursor < work.length) {
            signal?.throwIfAborted()
            const current = work[cursor++]
            if (!current) return
            try {
              const providerTitle = await options.fetchTitle(current.item, input, signal)
              if (!providerTitle.title.trim()) {
                missing.push(current.item)
                continue
              }
              const selectedPoster = selectLocalizedImage({
                candidates: providerTitle.posters.map((poster) => ({
                  aspectRatio: poster.aspect_ratio,
                  filePath: poster.file_path,
                  height: poster.height,
                  language: poster.iso_639_1,
                  voteAverage: poster.vote_average,
                  voteCount: poster.vote_count,
                  width: poster.width,
                })),
                kind: 'poster',
                locale: input.locale,
                originalLanguage: providerTitle.originalLanguage,
                placeholderPath: null,
                tmdbDefaultPath: providerTitle.defaultPosterPath,
              })
              const summary: ResolvedLocalizedTitleSummary = {
                backdropPath: providerTitle.backdropPath,
                id: current.item.tmdbId,
                mediaType: current.item.type,
                posterPath: selectedPoster.path,
                posterResolution: {
                  fallbackReason: selectedPoster.fallbackReason,
                  languageTier: selectedPoster.languageTier,
                  locale: input.locale,
                  source: 'tmdb-images',
                },
                title: providerTitle.title,
                year: providerTitle.year,
              }
              summaries[current.index] = summary
              setBoundedCache(cache, cacheKey(current.item, input), {
                expiresAt: now() + cacheTtlMs,
                summary,
              })
            } catch (error) {
              if (signal?.aborted) throw error
              errors.push(current.item)
            }
          }
        })
      )

      return {
        schemaVersion: LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
        errors,
        missing,
        summaries: summaries.filter(
          (summary): summary is ResolvedLocalizedTitleSummary => summary !== undefined
        ),
      }
    },
  }
}

export function createLocalizedTitleRateLimiter(options: {
  readonly limit: number
  readonly windowMs: number
}) {
  const windows = new Map<string, { count: number; resetAt: number }>()
  return {
    check(clientId: string, currentTime = Date.now()) {
      const current = windows.get(clientId)
      if (!current || current.resetAt <= currentTime) {
        windows.set(clientId, { count: 1, resetAt: currentTime + options.windowMs })
        return true
      }
      if (current.count >= options.limit) return false
      current.count += 1
      return true
    },
  }
}

function cacheKey(
  item: LocalizedTitleBatchItem,
  input: Pick<LocalizedTitleBatchInput, 'locale' | 'region'>
) {
  return `${item.type}:${item.tmdbId}:${input.locale}:${input.region}`
}

function setBoundedCache(cache: Map<string, CacheEntry>, key: string, value: CacheEntry) {
  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, value)
}
