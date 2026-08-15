'use client'

import type { TMDbTitle } from '@kino/core'
import { getDisplayTitle, getReleaseYear, getTMDbImageUrl } from '@kino/core'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { titlePath } from '@/lib/routes'
import { prefetchTitleSummary } from '@/lib/title-prefetch'
import { seedTitleSummary } from '@/lib/title-queries'
import { useSettingsStore } from '@/stores/settings-store'

export function useMediaPoster(item: TMDbTitle) {
  const queryClient = useQueryClient()
  const language = useSettingsStore((state) => state.language)
  const localeStatus = useSettingsStore((state) => state.localeStatus)

  const title = getDisplayTitle(item)
  const type: 'movie' | 'tv' = item.media_type === 'tv' ? 'tv' : 'movie'
  const year = getReleaseYear(item)
  const poster = getTMDbImageUrl(item.poster_path, 'w300')

  const prefetch = useCallback(() => {
    if (localeStatus !== 'ready') return

    const context = {
      id: item.id,
      locale: language,
      mediaType: type,
      region: localeRegion(language),
      scope: { kind: 'public' as const },
    }

    const summary = {
      backdropPath: item.backdrop_path,
      id: item.id,
      mediaType: type,
      posterPath: item.poster_path,
      title,
      year: year || null,
    }

    seedTitleSummary(queryClient, context, summary)

    void prefetchTitleSummary(queryClient, {
      ...context,
      fetchSummary: async () => summary,
    })
  }, [
    item.backdrop_path,
    item.id,
    item.poster_path,
    language,
    localeStatus,
    queryClient,
    title,
    type,
    year,
  ])

  return {
    href: titlePath(item.id, title, type),
    poster,
    prefetch,
    title,
    type,
    year,
  }
}

function localeRegion(locale: string) {
  const regions: Record<string, string> = {
    en: 'US',
    fr: 'FR',
    it: 'IT',
    no: 'NO',
    pt: 'BR',
  }

  return regions[locale] ?? 'US'
}
