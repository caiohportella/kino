import { useQuery } from '@tanstack/react-query'
import { getTMDbService } from '~/services/tmdb'
import type { TMDbMovie, TMDbTVShow, TMDbGenre } from '~/types'
import { useLanguage } from '~/hooks/useLanguage'
import { useOscarData, getAllOscarNomineeIdsLegacy } from '~/services/awards'

const tmdbService = getTMDbService()

export const TMDB_KEYS = {
  all: ['tmdb'] as const,
  trending: (type: string, time: string, lang: string) =>
    [...TMDB_KEYS.all, 'trending', type, time, lang] as const,
  popularMovies: (lang: string) => ['tmdb', 'movies', 'popular', lang] as const,
  popularTV: (lang: string) => ['tmdb', 'tv', 'popular', lang] as const,
  topRatedMovies: (lang: string) => ['tmdb', 'movies', 'topRated', lang] as const,
  nowPlayingMovies: (lang: string) => ['tmdb', 'movies', 'nowPlaying', lang] as const,
  upcomingMovies: (lang: string) => ['tmdb', 'movies', 'upcoming', lang] as const,
  movieDetails: (id: number, lang: string) => [...TMDB_KEYS.all, 'movie', id, lang] as const,
  tvDetails: (id: number, lang: string) => [...TMDB_KEYS.all, 'tv', id, lang] as const,
  seasonDetails: (id: number, season: number, lang: string) =>
    [...TMDB_KEYS.all, 'tv', id, 'season', season, lang] as const,
}

export function useTrending(type: 'all' | 'movie' | 'tv' = 'all', time: 'day' | 'week' = 'day') {
  const language = useLanguage()

  return useQuery({
    queryKey: TMDB_KEYS.trending(type, time, language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return tmdbService.getTrending(type, time)
    },
  })
}

export function usePopularMovies() {
  const language = useLanguage()

  return useQuery({
    queryKey: TMDB_KEYS.popularMovies(language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return tmdbService.getPopularMovies()
    },
  })
}

export function usePopularTV() {
  const language = useLanguage()

  return useQuery({
    queryKey: TMDB_KEYS.popularTV(language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return tmdbService.getPopularTV()
    },
  })
}

export function useTopRatedMovies() {
  const language = useLanguage()

  return useQuery({
    queryKey: TMDB_KEYS.topRatedMovies(language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return tmdbService.getTopRatedMovies()
    },
  })
}

export function useNowPlayingMovies() {
  const language = useLanguage()

  return useQuery({
    queryKey: TMDB_KEYS.nowPlayingMovies(language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return tmdbService.getNowPlayingMovies()
    },
  })
}

export function useUpcomingMovies() {
  const language = useLanguage()

  return useQuery({
    queryKey: TMDB_KEYS.upcomingMovies(language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return tmdbService.getUpcomingMovies()
    },
  })
}

export function useTitleDetailsFromTmdb(id: number, type: 'movie' | 'tv') {
  const language = useLanguage()

  return useQuery<
    | (TMDbMovie & { genres: TMDbGenre[]; runtime: number })
    | (TMDbTVShow & { genres: TMDbGenre[]; number_of_seasons: number; number_of_episodes: number })
  >({
    queryKey:
      type === 'movie' ? TMDB_KEYS.movieDetails(id, language) : TMDB_KEYS.tvDetails(id, language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return type === 'movie' ? tmdbService.getMovieDetails(id) : tmdbService.getTVDetails(id)
    },
    enabled: !!id,
  })
}

export function useSeasonDetails(id: number, seasonNumber: number) {
  const language = useLanguage()

  return useQuery({
    queryKey: TMDB_KEYS.seasonDetails(id, seasonNumber, language),
    queryFn: () => {
      tmdbService.setLanguage(language)
      return tmdbService.getSeasonDetails(id, seasonNumber)
    },
    enabled: !!id && seasonNumber !== undefined,
  })
}

export function useOscarNominees() {
  const language = useLanguage()
  const { data: awards } = useOscarData(2026)
  const nomineeIds = awards ? Object.keys(awards).map(Number) : getAllOscarNomineeIdsLegacy()

  return useQuery({
    queryKey: ['tmdb', 'oscar-nominees', language, awards ? 'dynamic' : 'static'],
    queryFn: async () => {
      tmdbService.setLanguage(language)
      const results = await Promise.all(
        nomineeIds.map(async (id: number) => {
          try {
            const details = await tmdbService.getMovieDetails(id)
            return { ...details, media_type: 'movie' as const }
          } catch (error) {
            console.error(`Failed to fetch details for TMDb ID ${id}:`, error)
            return null
          }
        })
      )
      return results.filter((r): r is any => r !== null)
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!nomineeIds.length,
  })
}
