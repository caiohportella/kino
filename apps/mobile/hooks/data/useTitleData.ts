import { useQuery } from '@tanstack/react-query'
import { getTMDbService } from '~/services/tmdb'
import { dbService } from '~/services/database'
import { transformMovieToTitleDetails, transformTVToTitleDetails } from '~/utils/tmdb-transform'
import type { MediaType } from '~/types'
import { useLanguage } from '~/hooks/useLanguage'

const tmdb = getTMDbService()

export const TITLE_DATA_KEYS = {
  metadata: (tmdbId: number, lang: string) => ['title', 'metadata', tmdbId, lang] as const,
  userData: (titleId: string) => ['title', 'userData', titleId] as const,
}

export function useTitleMetadata(tmdbId: number, type: MediaType) {
  const language = useLanguage()

  return useQuery({
    queryKey: TITLE_DATA_KEYS.metadata(tmdbId, language),
    queryFn: async () => {
      // Sync language before fetching
      tmdb.setLanguage(language)

      // 1. Fetch from TMDB
      let titleDetails: Omit<import('~/types').TitleDetails, 'averageRating' | 'ratingCount'>
      if (type === 'movie') {
        const [movie, credits] = await Promise.all([
          tmdb.getMovieDetails(tmdbId),
          tmdb.getMovieCredits(tmdbId),
        ])
        titleDetails = await transformMovieToTitleDetails(movie, credits)
      } else {
        const [tv, credits] = await Promise.all([
          tmdb.getTVDetails(tmdbId),
          tmdb.getTVCredits(tmdbId),
        ])
        titleDetails = await transformTVToTitleDetails(tv, credits)
      }

      // 2. Sync with Database to get our internal ID
      let titleId = ''
      try {
        titleId = await dbService.getOrCreateTitle({
          tmdbId: titleDetails.tmdbId,
          type: titleDetails.type,
          title: titleDetails.title,
          synopsis: titleDetails.synopsis,
          coverImage: titleDetails.coverImage,
          backdropImage: titleDetails.backdropImage,
          year: titleDetails.year,
          genres: titleDetails.genres,
          cast: titleDetails.cast,
          director: titleDetails.director,
          runtime: titleDetails.runtime,
          totalSeasons: titleDetails.totalSeasons,
          totalEpisodes: titleDetails.totalEpisodes,
          seasons: titleDetails.seasons,
        })
      } catch (error: unknown) {
        // Fallback for RLS/Anon users
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code: unknown }).code === '42501'
        ) {
          console.warn('Skipping title persistence for anonymous user')
          titleId = '00000000-0000-0000-0000-000000000000'
        } else {
          throw error
        }
      }

      return {
        ...titleDetails,
        id: titleId,
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - Metadata rarely changes
    enabled: !!tmdbId && !!type,
  })
}

export function useTitleUserData(titleId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: TITLE_DATA_KEYS.userData(titleId || ''),
    queryFn: async () => {
      if (!titleId || titleId === '00000000-0000-0000-0000-000000000000') {
        return {
          userRating: null,
          isWatched: false,
          isWatchlisted: false,
        }
      }

      const [userRating, lastWatch, isWatchlisted] = await Promise.all([
        userId ? dbService.getUserRating(titleId) : Promise.resolve(null),
        userId ? dbService.getLastWatchEntry(titleId) : Promise.resolve(null),
        userId ? dbService.isTitleWatchlisted(titleId) : Promise.resolve(false),
      ])

      return {
        userRating,
        isWatched: !!lastWatch,
        isWatchlisted,
      }
    },
    enabled: !!titleId && titleId !== '00000000-0000-0000-0000-000000000000',
  })
}
