'use client'

import { getLocale, getRegion } from '@kino/core/locale-config'
import {
  LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
  type LocalizedTitleNameBatchInput,
  normalizeLocalizedTitleNameBatchResponse,
} from '@kino/core/localization'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import type { LocalizedTitleRequest } from './use-localized-titles'
import { localizedTitleKey } from './use-localized-titles'

export function useLocalizedTitleNames(items: LocalizedTitleRequest[]) {
  const language = useSettingsStore((state) => state.language)

  const localeStatus = useSettingsStore((state) => state.localeStatus)

  const locale = getLocale(language)
  const region = getRegion(language)

  const uniqueItems = useMemo(() => {
    const map = new Map<string, LocalizedTitleRequest>()

    for (const item of items) {
      map.set(localizedTitleKey(item), item)
    }

    return Array.from(map.values()).sort((a, b) =>
      localizedTitleKey(a).localeCompare(localizedTitleKey(b))
    )
  }, [items])

  const query = useQuery({
    enabled: localeStatus !== 'resolving' && uniqueItems.length > 0,

    queryKey: [
      'localized-title-name-batch',
      LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
      locale,
      region,
      uniqueItems.map(localizedTitleKey).join(','),
    ],

    queryFn: async ({ signal }) => {
      const input: LocalizedTitleNameBatchInput = {
        schemaVersion: LOCALIZED_TITLE_NAME_BATCH_SCHEMA_VERSION,
        items: uniqueItems,
        locale,
        region,
      }

      const response = await fetch('/api/v1/titles/names', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
        signal,
      })

      if (!response.ok) {
        throw new Error(`Localized title name request failed with ${response.status}.`)
      }

      return normalizeLocalizedTitleNameBatchResponse(await response.json())
    },

    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  })

  const data = useMemo(() => {
    const names: Record<string, string> = {}

    for (const name of query.data?.names ?? []) {
      names[
        localizedTitleKey({
          tmdbId: name.id,
          type: name.mediaType,
        })
      ] = name.title
    }

    return names
  }, [query.data])

  return {
    ...query,
    data,
  }
}
