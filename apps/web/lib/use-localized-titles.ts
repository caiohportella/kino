'use client'

import type { MediaType } from '@kino/core'
import { LOCALIZED_TITLE_GC_TIME, LOCALIZED_TITLE_STALE_TIME } from '@kino/core/cache'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { hydrateLocalizedTitleBatch, requestLocalizedTitleBatch } from '@/lib/localized-title-batch'
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
  const queryClient = useQueryClient()
  const region = localeRegion(language)

  const batchQuery = useQuery({
    enabled: localeStatus !== 'resolving' && uniqueItems.length > 0,
    gcTime: LOCALIZED_TITLE_GC_TIME,
    queryFn: ({ signal }) =>
      hydrateLocalizedTitleBatch(
        queryClient,
        { items: uniqueItems, locale: language, region },
        requestLocalizedTitleBatch,
        signal
      ),
    queryKey: [
      'localized-title-batch',
      language,
      region,
      uniqueItems.map(localizedTitleKey).join(','),
    ],
    staleTime: LOCALIZED_TITLE_STALE_TIME,
  })

  const data = useMemo(
    () =>
      Object.fromEntries(
        (batchQuery.data?.summaries || []).map((summary) => {
          const item = { tmdbId: summary.id, type: summary.mediaType }
          return [
            localizedTitleKey(item),
            {
              backdropPath: summary.backdropPath,
              posterPath: summary.posterPath,
              title: summary.title,
              year: summary.year,
            },
          ]
        })
      ) as LocalizedTitleMap,
    [batchQuery.data]
  )

  return {
    data,
    errors: batchQuery.data?.errors || [],
    isError: batchQuery.isError,
    isPending: localeStatus === 'resolving' || (uniqueItems.length > 0 && batchQuery.isPending),
    missing: batchQuery.data?.missing || [],
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
