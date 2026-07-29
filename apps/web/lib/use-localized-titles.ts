'use client'

import type { MediaType } from '@kino/core'
import { titleQueryKeys } from '@kino/core/cache'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { LocalizedTitleSummary } from '@/lib/title-queries'
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
  const localeStatus = useSettingsStore((state) => state.localeStatus)
  const uniqueItems = useMemo(() => normalizeLocalizedItems(items), [items])

  const queryResults = useQueries({
    queries:
      localeStatus === 'resolving'
        ? []
        : uniqueItems.map((item) => ({
            enabled: false,
            queryFn: async (): Promise<LocalizedTitleSummary> => {
              throw new Error(
                'Localized summaries must be hydrated by locale-ready list responses.'
              )
            },
            queryKey: titleQueryKeys.summary({
              id: item.tmdbId,
              locale: language,
              mediaType: item.type,
              region: localeRegion(language),
              scope: { kind: 'public' },
            }),
          })),
  })

  const data = useMemo(
    () =>
      Object.fromEntries(
        queryResults.flatMap((result, index) => {
          const item = uniqueItems[index]
          if (!item || !result.data) return []
          return [
            [
              localizedTitleKey(item),
              {
                backdropPath: result.data.backdropPath,
                posterPath: result.data.posterPath,
                title: result.data.title,
                year: result.data.year,
              },
            ],
          ]
        })
      ) as LocalizedTitleMap,
    [queryResults, uniqueItems]
  )

  return {
    data,
    isPending: localeStatus === 'resolving',
  }
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
