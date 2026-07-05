// TMDb API Service
// Documentation: https://developer.themoviedb.org/docs

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

// Language code mapping (app codes → TMDb codes)
const LANGUAGE_MAP: Record<string, string> = {
  en: 'en-US',
  pt: 'pt-BR',
  it: 'it-IT',
  no: 'no-NO',
  fr: 'fr-FR',
}

export class TMDbService {
  private apiKey: string
  private language: string = 'en-US'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Set the language for API requests
   */
  setLanguage(appLanguage: string) {
    this.language = LANGUAGE_MAP[appLanguage] || 'en-US'
  }

  /**
   * Get the current TMDb language code
   */
  getLanguage(): string {
    return this.language
  }

  /**
   * Get the current app language code (reverse lookup)
   */
  getAppLanguage(): string {
    const entry = Object.entries(LANGUAGE_MAP).find(([_, tmdbCode]) => tmdbCode === this.language)
    return entry ? entry[0] : 'en'
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryParams = new URLSearchParams({
      api_key: this.apiKey,
      language: this.language,
      ...params,
    })

    const url = `${TMDB_API_BASE}${endpoint}?${queryParams}`
    const response = await fetch(url)

    if (!response.ok) {
      let errorMessage = `TMDb API error: ${response.status}`
      try {
        const errorData = await response.json()
        console.error('TMDb API Error Data:', errorData)
        if (errorData.status_message) {
          errorMessage += ` - ${errorData.status_message}`
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          errorMessage += ` - ${errorData.errors.join(', ')}`
        }
      } catch (e) {
        // Could not parse JSON, append status text if available
        if (response.statusText) {
          errorMessage += ` ${response.statusText}`
        }
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  /**
   * Search for movies and TV shows
   */
  async search(
    query: string,
    page = 1
  ): Promise<{
    results: import('../types').TMDbTitle[]
    total_pages: number
    total_results: number
  }> {
    const multiSearch = await this.fetch<{
      results: (import('../types').TMDbTitle & { media_type: string })[]
      total_pages: number
      total_results: number
    }>('/search/multi', {
      query,
      page: page.toString(),
    })

    // Filter to only movies and TV shows
    const filtered = multiSearch.results.filter(
      (item) => item.media_type === 'movie' || item.media_type === 'tv'
    )

    return {
      ...multiSearch,
      results: filtered,
    }
  }

  /**
   * Get trending movies and TV shows
   */
  async getTrending(
    type: 'all' | 'movie' | 'tv' = 'all',
    timeWindow: 'day' | 'week' = 'day'
  ): Promise<(import('../types').TMDbTitle & { media_type: string })[]> {
    const response = await this.fetch<{
      results: (import('../types').TMDbTitle & { media_type: string })[]
    }>(`/trending/${type}/${timeWindow}`)
    return response.results
  }

  /**
   * Get top rated movies
   */
  async getTopRatedMovies(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[]
    }>('/movie/top_rated')
    return response.results.map((item) => ({ ...item, media_type: 'movie' }))
  }

  /**
   * Get top rated TV shows
   */
  async getTopRatedTV(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[]
    }>('/tv/top_rated')
    return response.results.map((item) => ({ ...item, media_type: 'tv' }))
  }

  /**
   * Get popular movies
   */
  async getPopularMovies(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[]
    }>('/movie/popular')
    return response.results.map((item) => ({ ...item, media_type: 'movie' }))
  }

  /**
   * Get popular TV shows
   */
  async getPopularTV(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[]
    }>('/tv/popular')
    return response.results.map((item) => ({ ...item, media_type: 'tv' }))
  }

  /**
   * Get movies currently in theaters (Now Playing)
   */
  async getNowPlayingMovies(region?: string, page = 1): Promise<import('../types').TMDbTitle[]> {
    const data = await this.fetch<{ results: import('../types').TMDbTitle[] }>('/movie/now_playing', {
      region: region || this.language.split('-')[1] || 'US',
      page: page.toString(),
    })
    return data.results.map((m) => ({ ...m, media_type: 'movie' as const }))
  }

  /**
   * Get on the air TV shows (New Releases equivalent)
   */
  async getOnTheAirTV(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[]
    }>('/tv/on_the_air')
    return response.results.map((item) => ({ ...item, media_type: 'tv' }))
  }

  /**
   * Get upcoming movies
   */
  async getUpcomingMovies(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[]
    }>('/movie/upcoming')
    return response.results.map((item) => ({ ...item, media_type: 'movie' }))
  }

  /**
   * Get genres for movies or TV shows
   */
  async getGenres(type: 'movie' | 'tv'): Promise<import('../types').TMDbGenre[]> {
    const response = await this.fetch<{
      genres: import('../types').TMDbGenre[]
    }>(`/genre/${type}/list`)
    return response.genres
  }

  /**
   * Discover movies or TV shows by genre or other filters
   */
  async discoverMedia(
    type: 'movie' | 'tv',
    params: Record<string, string> = {}
  ): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[]
    }>(`/discover/${type}`, params)
    return response.results.map((item) => ({ ...item, media_type: type }))
  }

  /**
   * Get movie details
   */
  async getMovieDetails(movieId: number): Promise<
    import('../types').TMDbMovie & {
      genres: import('../types').TMDbGenre[]
      runtime: number
      external_ids: import('../types').TMDbExternalIds
    }
  > {
    return this.fetch(`/movie/${movieId}`, { append_to_response: 'external_ids' })
  }

  /**
   * Get TV show details
   */
  async getTVDetails(tvId: number): Promise<
    import('../types').TMDbTVShow & {
      genres: import('../types').TMDbGenre[]
      number_of_seasons: number
      number_of_episodes: number
      external_ids: import('../types').TMDbExternalIds
    }
  > {
    return this.fetch(`/tv/${tvId}`, { append_to_response: 'external_ids' })
  }

  /**
   * Get movie credits (cast and crew)
   */
  async getMovieCredits(movieId: number): Promise<{
    cast: import('../types').TMDbCast[]
    crew: import('../types').TMDbCast[]
  }> {
    return this.fetch(`/movie/${movieId}/credits`)
  }

  /**
   * Get movie release dates per country
   */
  async getMovieReleaseDates(movieId: number): Promise<{
    results: {
      iso_3166_1: string
      release_dates: {
        certification: string
        iso_639_1: string
        release_date: string
        type: number
        note: string
      }[]
    }[]
  }> {
    return this.fetch(`/movie/${movieId}/release_dates`)
  }

  /**
   * Get TV show credits (cast and crew)
   */
  async getTVCredits(tvId: number): Promise<{
    cast: import('../types').TMDbCast[]
    crew: import('../types').TMDbCast[]
  }> {
    return this.fetch(`/tv/${tvId}/credits`)
  }

  /**
   * Get TV show season details
   */
  async getSeasonDetails(
    tvId: number,
    seasonNumber: number
  ): Promise<
    import('../types').TMDbSeason & {
      episodes: import('../types').TMDbEpisode[]
    }
  > {
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}`)
  }

  /**
   * Get TV show episode details
   */
  async getEpisodeDetails(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<import('../types').TMDbEpisode> {
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`)
  }

  /**
   * Get person details including combined credits and external ids
   */
  async getPersonDetails(personId: number): Promise<
    import('../types').TMDbPerson & {
      combined_credits: import('../types').TMDbPersonCombinedCredits
    }
  > {
    return this.fetch(`/person/${personId}`, {
      append_to_response: 'combined_credits,external_ids',
    })
  }

  /**
   * Get images for a movie or TV show
   */
  async getMediaImages(
    type: 'movie' | 'tv',
    id: number
  ): Promise<{
    backdrops: import('../types').TMDbImage[]
    posters: import('../types').TMDbImage[]
    logos: import('../types').TMDbImage[]
  }> {
    return this.fetch(`/${type}/${id}/images`, { include_image_language: 'en,null' })
  }

  /**
   * Get image URL
   */
  getImageUrl(
    path: string | null,
    size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500'
  ): string | null {
    if (!path) return null
    if (path.startsWith('http')) return path
    return `${TMDB_IMAGE_BASE}/${size}${path}`
  }

  /**
   * Get backdrop image URL
   */
  getBackdropUrl(
    path: string | null,
    size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'
  ): string | null {
    if (!path) return null
    if (path.startsWith('http')) return path
    return `${TMDB_IMAGE_BASE}/${size}${path}`
  }
}

// Singleton instance - will be initialized with API key from env
let tmdbServiceInstance: TMDbService | null = null

export function getTMDbService(): TMDbService {
  if (!tmdbServiceInstance) {
    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_TMDB_API_KEY is not set in environment variables')
    }
    tmdbServiceInstance = new TMDbService(apiKey)
  }
  return tmdbServiceInstance
}
