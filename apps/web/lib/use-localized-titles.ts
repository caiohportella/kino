'use client'

import type { MediaType } from '@kino/core'
import { getReleaseYear } from '@kino/core'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTmdb } from '@/lib/services'
import { useSettingsStore } from '@/stores/settings-store'

export interface LocalizedTitleRequest {
  tmdbId: number
  type: MediaType
}

export interface LocalizedTitleValue {
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number | null
}

export type LocalizedTitleMap = Record<string, LocalizedTitleValue>

export function localizedTitleKey(item: LocalizedTitleRequest) {
  return `${item.type}:${item.tmdbId}`
}

export function useLocalizedTitles(items: LocalizedTitleRequest[]) {
  const language = useSettingsStore((state) => state.language)
  const uniqueItems = useMemo(() => normalizeLocalizedItems(items), [items])
  const itemsKey = uniqueItems.map(localizedTitleKey).join(',')

  return useQuery({
    queryKey: ['localized-titles', language, itemsKey],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)

      const entries = await Promise.all(
        uniqueItems.map(async (item) => {
          try {
            if (item.type === 'tv') {
              const details = await tmdb.getTVDetails(item.tmdbId)
              return [
                localizedTitleKey(item),
                {
                  title: details.name,
                  posterPath: details.poster_path,
                  backdropPath: details.backdrop_path,
                  year: getReleaseYear(details),
                },
              ] as const
            }

            const details = await tmdb.getMovieDetails(item.tmdbId)
            return [
              localizedTitleKey(item),
              {
                title: details.title,
                posterPath: details.poster_path,
                backdropPath: details.backdrop_path,
                year: getReleaseYear(details),
              },
            ] as const
          } catch {
            return null
          }
        })
      )

      return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null))
    },
    enabled: uniqueItems.length > 0,
    staleTime: 1000 * 60 * 30,
  })
}

function normalizeLocalizedItems(items: LocalizedTitleRequest[]) {
  const uniqueItems = new Map<string, LocalizedTitleRequest>()

  for (const item of items) {
    if (!Number.isFinite(item.tmdbId) || item.tmdbId <= 0) continue
    uniqueItems.set(localizedTitleKey(item), item)
  }

  return Array.from(uniqueItems.values()).sort((left, right) => {
    const leftKey = localizedTitleKey(left)
    const rightKey = localizedTitleKey(right)
    return leftKey.localeCompare(rightKey)
  })
}
