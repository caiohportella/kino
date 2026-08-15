'use client'

import type { MediaType, TitleDetails } from '@kino/core'
import { transformMovieToTitleDetails, transformTVToTitleDetails } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import type { TitleContextData } from '@/components/title/title-context'
import { db, getTmdb } from '@/lib/services'

export const ANON_TITLE_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Bundles every read query the title page needs:
 * - the TMDB-backed title itself (and its local db id)
 * - the viewer's profile, personal data (rating/diary/watchlist), and site-wide stats
 * - supplementary TMDB context (now playing, trailer, providers, recommendations)
 */
export function useTitleData({
  tmdbId,
  type,
  language,
  userId,
}: {
  tmdbId: number
  type: MediaType
  language: string
  userId: string | undefined
}) {
  const titleQuery = useQuery({
    queryKey: ['title-metadata', tmdbId, type, language],
    queryFn: async () => {
      const tmdb = getTmdb()
      tmdb.setLanguage(language)
      const details =
        type === 'movie'
          ? transformMovieToTitleDetails(
              tmdb,
              await tmdb.getMovieDetails(tmdbId),
              await tmdb.getMovieCredits(tmdbId)
            )
          : transformTVToTitleDetails(
              tmdb,
              await tmdb.getTVDetails(tmdbId),
              await tmdb.getTVCredits(tmdbId)
            )

      let id = ANON_TITLE_ID
      try {
        id = await db.getOrCreateTitle(details)
      } catch (error) {
        if (
          !(
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === '42501'
          )
        ) {
          throw error
        }
      }

      void fetch('/api/v1/search/sync-title', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tmdbId, type }),
      }).catch(() => undefined)

      return {
        ...details,
        id,
        averageRating: 0,
        ratingCount: 0,
      } satisfies TitleDetails
    },
    enabled: Number.isFinite(tmdbId),
  })

  const title = titleQuery.data

  const currentProfileQuery = useQuery({
    queryKey: ['current-kino-profile', userId],
    queryFn: () => db.getUserProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })

  const userDataQuery = useQuery({
    queryKey: ['title-user-data', title?.id, userId],
    queryFn: async () => {
      if (!title || title.id === ANON_TITLE_ID || !userId)
        throw new Error('User data is unavailable.')

      const [userRating, lastWatch, isWatchlisted] = await Promise.all([
        db.getUserRating(title.id),
        db.getLastWatchEntry(title.id),
        db.isTitleWatchlisted(title.id),
      ])
      return { userRating, lastWatch, isWatchlisted }
    },
    enabled: Boolean(title && userId),
  })

  const statsQuery = useQuery({
    queryKey: ['title-stats', title?.id, type],
    queryFn: () => db.getTitleRatingStats(title!.id, type),
    enabled: Boolean(title?.id && title.id !== ANON_TITLE_ID),
  })

  const nowPlayingQuery = useQuery({
    queryKey: ['tmdb-now-playing', 'BR'],
    queryFn: () => getTmdb().getNowPlayingMovies('BR', 'pt-BR'),
    enabled: type === 'movie' && Number.isFinite(tmdbId),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  const contextQuery = useQuery<TitleContextData>({
    queryKey: ['title-context', tmdbId, type, language],
    queryFn: async () => {
      const response = await fetch(
        `/api/tmdb/title/${tmdbId}/context?type=${type}&language=${encodeURIComponent(language)}`
      )
      if (!response.ok) throw new Error('Title context is unavailable.')
      return response.json() as Promise<TitleContextData>
    },
    enabled: Number.isFinite(tmdbId),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  return {
    titleQuery,
    title,
    currentProfileQuery,
    userDataQuery,
    statsQuery,
    nowPlayingQuery,
    contextQuery,
  }
}
