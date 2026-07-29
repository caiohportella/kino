import { titleQueryKeys } from '@kino/core/cache'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { LocalizedTitleSummary } from '~/hooks/data/titleQueries'
import { useReadyLanguage } from '~/hooks/useLanguage'

export interface LocalizedMedia {
  title: string
  poster_path: string | null
}

export type LocalizedMediaMap = Record<string, LocalizedMedia | undefined> & {
  readonly isPending: boolean
}

/**
 * Given a list of items with tmdb_id and type, fetches the localized title
 * and poster path from TMDB in the current app language and returns a map.
 */
export function useLocalizedMediaData(items: { tmdb_id: number; type: 'movie' | 'tv' }[]) {
  const language = useReadyLanguage()
  const uniqueItems = useMemo(() => normalizeLocalizedItems(items), [items])
  const queryResults = useQueries({
    queries: language
      ? uniqueItems.map((item) => ({
          enabled: false,
          queryFn: async (): Promise<LocalizedTitleSummary> => {
            throw new Error('Localized summaries must be hydrated by locale-ready list responses.')
          },
          queryKey: titleQueryKeys.summary({
            id: item.tmdb_id,
            locale: language,
            mediaType: item.type,
            region: localeRegion(language),
            scope: { kind: 'public' },
          }),
        }))
      : [],
  })

  return useMemo(() => {
    const data = Object.fromEntries(
      queryResults.flatMap((result, index) => {
        const item = uniqueItems[index]
        if (!item || !result.data) return []
        const localized = {
          poster_path: result.data.posterPath,
          title: result.data.title,
        }
        return [
          [localizedMediaKey(item), localized],
          [item.tmdb_id, localized],
        ]
      })
    ) as Record<number, LocalizedMedia>
    return Object.assign(data, { isPending: !language }) as unknown as LocalizedMediaMap
  }, [queryResults, uniqueItems, language])
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
