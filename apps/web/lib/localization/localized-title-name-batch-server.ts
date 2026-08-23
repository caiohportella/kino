import { TMDbService } from '@kino/core'

import {
  LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
  type LocalizedTitleNameBatchInput,
  type LocalizedTitleNameBatchItem,
  type LocalizedTitleNameBatchResponse,
  localeBaseLanguage,
  type ResolvedLocalizedTitleName,
} from '@kino/core/localization'

const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const DEFAULT_CONCURRENCY = 8
const MAX_CACHE_ENTRIES = 2_000

interface CacheEntry {
  readonly expiresAt: number
  readonly name: ResolvedLocalizedTitleName
}

interface ServiceOptions {
  readonly cache?: Map<string, CacheEntry>
  readonly cacheTtlMs?: number
  readonly concurrency?: number
  readonly fetchTitleName: (
    item: LocalizedTitleNameBatchItem,
    input: Pick<LocalizedTitleNameBatchInput, 'locale' | 'region'>,
    signal?: AbortSignal
  ) => Promise<string>
  readonly now?: () => number
}

export function createLocalizedTitleNameBatchService(options: ServiceOptions) {
  const cache = options.cache ?? new Map<string, CacheEntry>()
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY))
  const now = options.now ?? Date.now

  const inFlight = new Map<string, Promise<ResolvedLocalizedTitleName | null>>()

  return {
    async resolve(
      input: LocalizedTitleNameBatchInput,
      signal?: AbortSignal
    ): Promise<LocalizedTitleNameBatchResponse> {
      const names: Array<ResolvedLocalizedTitleName | undefined> = new Array(input.items.length)

      const missing: LocalizedTitleNameBatchItem[] = []
      const errors: LocalizedTitleNameBatchItem[] = []

      const work: Array<{
        index: number
        item: LocalizedTitleNameBatchItem
      }> = []

      const seen = new Set<string>()

      input.items.forEach((item, index) => {
        const key = cacheKey(item, input)

        if (seen.has(key)) {
          return
        }

        seen.add(key)

        const cached = cache.get(key)

        if (cached && cached.expiresAt > now()) {
          names[index] = cached.name
          return
        }

        if (cached) {
          cache.delete(key)
        }

        work.push({
          index,
          item,
        })
      })

      let cursor = 0

      await Promise.all(
        Array.from(
          {
            length: Math.min(concurrency, work.length),
          },
          async () => {
            while (cursor < work.length) {
              signal?.throwIfAborted()

              const current = work[cursor++]

              if (!current) {
                return
              }

              const key = cacheKey(current.item, input)

              try {
                const name = await resolveTitleName(current.item, input, key, signal)

                if (!name) {
                  missing.push(current.item)
                  continue
                }

                names[current.index] = name
              } catch (error) {
                if (signal?.aborted) {
                  throw error
                }

                errors.push(current.item)
              }
            }
          }
        )
      )

      return {
        schemaVersion: LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
        names: names.filter((name): name is ResolvedLocalizedTitleName => name !== undefined),
        missing,
        errors,
      }
    },
  }

  async function resolveTitleName(
    item: LocalizedTitleNameBatchItem,
    input: Pick<LocalizedTitleNameBatchInput, 'locale' | 'region'>,
    key: string,
    signal?: AbortSignal
  ): Promise<ResolvedLocalizedTitleName | null> {
    const cached = cache.get(key)

    if (cached && cached.expiresAt > now()) {
      return cached.name
    }

    if (cached) {
      cache.delete(key)
    }

    const pending = inFlight.get(key)

    if (pending) {
      return pending
    }

    const promise = (async () => {
      const title = await options.fetchTitleName(
        item,
        {
          locale: input.locale,
          region: input.region,
        },
        signal
      )

      if (!title.trim()) {
        return null
      }

      const name: ResolvedLocalizedTitleName = {
        id: item.tmdbId,
        mediaType: item.type,
        title,
      }

      setBoundedCache(cache, key, {
        expiresAt: now() + cacheTtlMs,
        name,
      })

      return name
    })()

    inFlight.set(key, promise)

    try {
      return await promise
    } finally {
      if (inFlight.get(key) === promise) {
        inFlight.delete(key)
      }
    }
  }
}

export function createTmdbLocalizedTitleNameBatchService(apiKey: string) {
  return createLocalizedTitleNameBatchService({
    fetchTitleName: async (item, context) => {
      const startedAt = performance.now()

      try {
        const tmdb = new TMDbService(apiKey)

        tmdb.setLanguage(localeBaseLanguage(context.locale))

        if (item.type === 'movie') {
          const details = await tmdb.getMovieDetails(item.tmdbId)

          console.log('[title-name:tmdb]', {
            tmdbId: item.tmdbId,
            type: item.type,
            durationMs: Math.round(performance.now() - startedAt),
          })

          return details.title ?? ''
        }

        const details = await tmdb.getTVDetails(item.tmdbId)

        console.log('[title-name:tmdb]', {
          tmdbId: item.tmdbId,
          type: item.type,
          durationMs: Math.round(performance.now() - startedAt),
        })

        return details.name ?? ''
      } catch (error) {
        console.log('[title-name:tmdb:error]', {
          tmdbId: item.tmdbId,
          type: item.type,
          durationMs: Math.round(performance.now() - startedAt),
        })

        throw error
      }
    },
  })
}

function cacheKey(
  item: LocalizedTitleNameBatchItem,
  input: Pick<LocalizedTitleNameBatchInput, 'locale' | 'region'>
) {
  return `${item.type}:${item.tmdbId}:${input.locale}:${input.region}`
}

function setBoundedCache(cache: Map<string, CacheEntry>, key: string, value: CacheEntry) {
  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value

    if (oldest) {
      cache.delete(oldest)
    }
  }

  cache.set(key, value)
}
