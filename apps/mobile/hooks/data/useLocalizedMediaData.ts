import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { titleSummaryQueryOptions } from '~/hooks/data/titleQueries'
import { useReadyLanguage } from '~/hooks/useLanguage'
import { getTMDbService } from '~/services/tmdb'

export interface LocalizedMedia {
  title: string
  poster_path: string | null
}

export type LocalizedMediaMap = {
  [tmdbId: number]: LocalizedMedia
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
      ? uniqueItems.map((item) =>
          titleSummaryQueryOptions({
            fetchSummary: async (request) => {
              const tmdb = getTMDbService()
              tmdb.setLanguage(request.locale)

              if (request.mediaType === 'tv') {
                const details = await tmdb.getTVDetails(request.id)
                return {
                  backdropPath: details.backdrop_path,
                  id: request.id,
                  mediaType: request.mediaType,
                  posterPath: details.poster_path,
                  title: details.name,
                  year: releaseYear(details.first_air_date),
                }
              }

              const details = await tmdb.getMovieDetails(request.id)
              return {
                backdropPath: details.backdrop_path,
                id: request.id,
                mediaType: request.mediaType,
                posterPath: details.poster_path,
                title: details.title,
                year: releaseYear(details.release_date),
              }
            },
            id: item.tmdb_id,
            locale: language,
            mediaType: item.type,
            region: localeRegion(language),
            scope: { kind: 'public' },
          })
        )
      : [],
  })

  return useMemo(() => {
    const data = Object.fromEntries(
      queryResults.flatMap((result, index) => {
        const item = uniqueItems[index]
        if (!item || !result.data) return []
        return [
          [
            item.tmdb_id,
            {
              poster_path: result.data.posterPath,
              title: result.data.title,
            },
          ],
        ]
      })
    ) as Record<number, LocalizedMedia>
    return Object.assign(data, {
      isPending: queryResults.some((result) => result.isPending),
    }) as LocalizedMediaMap
  }, [queryResults, uniqueItems])
}

/**
 * Singular version of useLocalizedMediaData for a single item.
 */
export function useLocalizedTitle(tmdbId: number, type: 'movie' | 'tv') {
  const mediaMap = useLocalizedMediaData(useMemo(() => [{ tmdb_id: tmdbId, type }], [tmdbId, type]))
  return mediaMap[tmdbId] || null
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

function releaseYear(date: string | undefined) {
  if (!date) return null
  const year = Number.parseInt(date.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}
