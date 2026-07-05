import { useQuery } from '@tanstack/react-query'
import { getTMDbService } from '~/services/tmdb'
import { useLanguage } from '~/hooks/useLanguage'

const tmdb = getTMDbService()

export function useTheaterStatus(movieId: number | undefined, type: string | undefined) {
  const language = useLanguage()
  const region = language.split('-')[1] || 'US'

  return useQuery({
    queryKey: ['movie', 'theaterStatus', movieId, region],
    queryFn: async () => {
      if (!movieId || type !== 'movie') return false

      try {
        // Method 1: Check if it's in the Now Playing list for the region
        const nowPlaying = await tmdb.getNowPlayingMovies(region)
        const isInNowPlaying = nowPlaying.some((m) => m.id === movieId)
        if (isInNowPlaying) return true

        // Method 2: Check release dates for theatrical release (type 3)
        const releaseData = await tmdb.getMovieReleaseDates(movieId)
        const countryData = releaseData.results.find((r) => r.iso_3166_1 === region)
        
        if (countryData) {
          const now = new Date()
          const threeMonthsAgo = new Date()
          threeMonthsAgo.setMonth(now.getMonth() - 3)

          const hasRecentTheatricalRelease = countryData.release_dates.some((rd) => {
            const releaseDate = new Date(rd.release_date)
            // Type 3 is Theatrical
            return rd.type === 3 && releaseDate <= now && releaseDate >= threeMonthsAgo
          })

          return hasRecentTheatricalRelease
        }

        return false
      } catch (error) {
        console.error('Error checking theater status:', error)
        return false
      }
    },
    enabled: !!movieId && type === 'movie',
    staleTime: 1000 * 60 * 60 * 6, // 6 hours
  })
}
