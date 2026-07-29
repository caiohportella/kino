import { LOCALIZED_TITLE_GC_TIME, LOCALIZED_TITLE_STALE_TIME } from '@kino/core/cache'
import { LOCALIZED_TITLE_BATCH_SCHEMA_VERSION } from '@kino/core/localization'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  hydrateLocalizedTitleBatch,
  requestLocalizedTitleBatch,
} from '~/hooks/data/localizedTitleBatch'
import { useReadyLanguage } from '~/hooks/useLanguage'

export interface LocalizedMedia {
  title: string
  poster_path: string | null
}

export type LocalizedMediaMap = Record<string, LocalizedMedia | undefined> & {
  readonly errors: Array<{ tmdbId: number; type: 'movie' | 'tv' }>
  readonly isError: boolean
  readonly isPending: boolean
  readonly missing: Array<{ tmdbId: number; type: 'movie' | 'tv' }>
}

/**
 * Given a list of items with tmdb_id and type, fetches the localized title
 * and poster path from TMDB in the current app language and returns a map.
 */
export function useLocalizedMediaData(items: { tmdb_id: number; type: 'movie' | 'tv' }[]) {
  const language = useReadyLanguage()
  const uniqueItems = useMemo(() => normalizeLocalizedItems(items), [items])
  const queryClient = useQueryClient()
  const region = localeRegion(language ?? 'en')
  const batchQuery = useQuery({
    enabled: Boolean(language && uniqueItems.length > 0),
    gcTime: LOCALIZED_TITLE_GC_TIME,
    queryFn: ({ signal }) =>
      hydrateLocalizedTitleBatch(
        queryClient,
        {
          schemaVersion: LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
          items: uniqueItems.map((item) => ({ tmdbId: item.tmdb_id, type: item.type })),
          locale: language ?? 'en',
          region,
        },
        requestLocalizedTitleBatch,
        signal
      ),
    queryKey: [
      'localized-title-batch',
      LOCALIZED_TITLE_BATCH_SCHEMA_VERSION,
      language,
      region,
      uniqueItems.map(localizedMediaKey).join(','),
    ],
    staleTime: LOCALIZED_TITLE_STALE_TIME,
  })

  return useMemo(() => {
    const data = Object.fromEntries(
      (batchQuery.data?.summaries || []).flatMap((summary) => {
        const item = { tmdb_id: summary.id, type: summary.mediaType }
        const localized = {
          poster_path: summary.posterPath,
          title: summary.title,
        }
        return [
          [localizedMediaKey(item), localized],
          [item.tmdb_id, localized],
        ]
      })
    ) as Record<number, LocalizedMedia>
    return Object.assign(data, {
      errors: batchQuery.data?.errors || [],
      isError: batchQuery.isError,
      isPending: !language || (uniqueItems.length > 0 && batchQuery.isPending),
      missing: batchQuery.data?.missing || [],
    }) as unknown as LocalizedMediaMap
  }, [batchQuery.data, batchQuery.isError, batchQuery.isPending, uniqueItems.length, language])
}

/**
 * Singular version of useLocalizedMediaData for a single item.
 */
export function useLocalizedTitle(tmdbId: number, type: 'movie' | 'tv') {
  const mediaMap = useLocalizedMediaData(useMemo(() => [{ tmdb_id: tmdbId, type }], [tmdbId, type]))
  return (mediaMap[localizedMediaKey({ tmdb_id: tmdbId, type })] as LocalizedMedia) || null
}

export function localizedMediaKey(item: { tmdb_id: number; type: 'movie' | 'tv' }) {
  return `${item.type}:${item.tmdb_id}`
}

function normalizeLocalizedItems(items: { tmdb_id: number; type: 'movie' | 'tv' }[]) {
  const uniqueItems = new Map<string, (typeof items)[number]>()
  for (const item of items) {
    if (!Number.isSafeInteger(item.tmdb_id) || item.tmdb_id <= 0) continue
    uniqueItems.set(`${item.type}:${item.tmdb_id}`, item)
  }
  return Array.from(uniqueItems.values()).sort((left, right) => {
    return `${left.type}:${left.tmdb_id}`.localeCompare(`${right.type}:${right.tmdb_id}`)
  })
}

function localeRegion(language: string) {
  return (
    {
      en: 'US',
      fr: 'FR',
      it: 'IT',
      no: 'NO',
      pt: 'BR',
    }[language] ?? 'US'
  )
}
