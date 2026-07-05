import { useEffect, useState, useMemo } from 'react'
import { getTMDbService } from '~/services/tmdb'
import { useLanguage } from '~/hooks/useLanguage'

export interface LocalizedMedia {
  title: string
  poster_path: string | null
}

/**
 * Given a list of items with tmdb_id and type, fetches the localized title
 * and poster path from TMDB in the current app language and returns a map.
 */
export function useLocalizedMediaData(
  items: { tmdb_id: number; type: 'movie' | 'tv' }[]
) {
  const language = useLanguage()
  const [mediaMap, setMediaMap] = useState<Record<number, LocalizedMedia>>({})

  useEffect(() => {
    if (items.length === 0) return

    const tmdb = getTMDbService()
    tmdb.setLanguage(language)

    let cancelled = false

    const fetchMediaData = async () => {
      const map: Record<number, LocalizedMedia> = {}

      // Fetch in parallel, batching up to 10 at a time to be gentle
      const batchSize = 10
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            if (item.type === 'movie' || !item.type) {
              const details = await tmdb.getMovieDetails(item.tmdb_id)
              return { 
                tmdbId: item.tmdb_id, 
                title: details.title,
                poster_path: details.poster_path 
              }
            } else {
              const details = await tmdb.getTVDetails(item.tmdb_id)
              return { 
                tmdbId: item.tmdb_id, 
                title: details.name,
                poster_path: details.poster_path
              }
            }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled') {
            map[result.value.tmdbId] = {
              title: result.value.title,
              poster_path: result.value.poster_path
            }
          }
        }
      }

      if (!cancelled) {
        setMediaMap(map)
      }
    }

    fetchMediaData()

    return () => {
      cancelled = true
    }
  }, [items, language])

  return mediaMap
}

/**
 * Singular version of useLocalizedMediaData for a single item.
 */
export function useLocalizedTitle(tmdbId: number, type: 'movie' | 'tv') {
  const mediaMap = useLocalizedMediaData(useMemo(() => [{ tmdb_id: tmdbId, type }], [tmdbId, type]))
  return mediaMap[tmdbId] || null
}
