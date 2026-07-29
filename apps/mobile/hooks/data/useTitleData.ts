import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type LocalizedTitleSummary, titleDetailsQueryOptions } from '~/hooks/data/titleQueries'
import { useReadyLanguage } from '~/hooks/useLanguage'
import { dbService } from '~/services/database'
import { getTMDbService } from '~/services/tmdb'
import type { MediaType, TitleDetails } from '~/types'
import { transformMovieToTitleDetails, transformTVToTitleDetails } from '~/utils/tmdb-transform'

const tmdb = getTMDbService()
type MobileCanonicalTitleDetails = Omit<TitleDetails, 'id'> &
  LocalizedTitleSummary & { kinoId: string }

export const TITLE_DATA_KEYS = {
  userData: (titleId: string) => ['title', 'userData', titleId] as const,
}

export function useTitleMetadata(tmdbId: number, type: MediaType) {
  const language = useReadyLanguage()
  const queryClient = useQueryClient()

  const query = useQuery(
    titleDetailsQueryOptions<MobileCanonicalTitleDetails>(queryClient, {
      enabled: Boolean(language && tmdbId && type),
      id: tmdbId,
      locale: language ?? 'en',
      mediaType: type,
      region: localeRegion(language ?? 'en'),
      scope: { kind: 'public' },
      fetchDetails: async () => {
        // Sync language before fetching
        tmdb.setLanguage(language ?? 'en')

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

        const { id: _databaseId, ...details } = { ...titleDetails, id: titleId }
        return {
          ...details,
          averageRating: 0,
          backdropPath: tmdbPath(details.backdropImage),
          id: tmdbId,
          kinoId: titleId,
          mediaType: type,
          posterPath: tmdbPath(details.coverImage),
          ratingCount: 0,
        } satisfies MobileCanonicalTitleDetails
      },
    })
  )

  const data: TitleDetails | undefined =
    query.data && 'kinoId' in query.data ? { ...query.data, id: query.data.kinoId } : undefined
  return {
    ...query,
    data,
    isLoading: query.isPending || query.isPlaceholderData,
  }
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

function localeRegion(locale: string) {
  const regions: Record<string, string> = { en: 'US', fr: 'FR', it: 'IT', no: 'NO', pt: 'BR' }
  return regions[locale] ?? 'US'
}

function tmdbPath(url: string | null) {
  if (!url) return null
  const marker = '/t/p/'
  const index = url.indexOf(marker)
  if (index < 0) return url
  const pathStart = url.indexOf('/', index + marker.length)
  return pathStart < 0 ? null : url.slice(pathStart)
}
