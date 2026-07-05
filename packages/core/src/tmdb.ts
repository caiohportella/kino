import type {
  MediaType,
  TMDbCast,
  TMDbCredits,
  TMDbEpisode,
  TMDbGenre,
  TMDbImage,
  TMDbMovie,
  TMDbPerson,
  TMDbTitle,
  TMDbTVShow,
  TitleDetails,
} from './types'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

const LANGUAGE_MAP: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  it: 'it-IT',
  no: 'no-NO',
  pt: 'pt-BR',
}

export class TMDbService {
  private language = 'en-US'

  constructor(private readonly apiKey: string) {}

  setLanguage(appLanguage: string) {
    this.language = LANGUAGE_MAP[appLanguage] || 'en-US'
  }

  async search(
    query: string,
    page = 1
  ): Promise<{ results: TMDbTitle[]; total_pages: number; total_results: number }> {
    const data = await this.request<{
      results: (TMDbTitle & { media_type: string })[]
      total_pages: number
      total_results: number
    }>('/search/multi', { query, page: String(page) })

    return {
      ...data,
      results: data.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv'),
    }
  }

  async getTrending(type: 'all' | MediaType = 'all', timeWindow: 'day' | 'week' = 'day') {
    const data = await this.request<{ results: (TMDbTitle & { media_type: MediaType })[] }>(
      `/trending/${type}/${timeWindow}`
    )
    return data.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
  }

  async getPopularMovies() {
    const data = await this.request<{ results: TMDbTitle[] }>('/movie/popular')
    return data.results.map((item) => ({ ...item, media_type: 'movie' as const }))
  }

  async getPopularTV() {
    const data = await this.request<{ results: TMDbTitle[] }>('/tv/popular')
    return data.results.map((item) => ({ ...item, media_type: 'tv' as const }))
  }

  async getTopRatedMovies() {
    const data = await this.request<{ results: TMDbTitle[] }>('/movie/top_rated')
    return data.results.map((item) => ({ ...item, media_type: 'movie' as const }))
  }

  async getNowPlayingMovies(region?: string) {
    const data = await this.request<{ results: TMDbTitle[] }>('/movie/now_playing', {
      region: region || this.language.split('-')[1] || 'US',
    })
    return data.results.map((item) => ({ ...item, media_type: 'movie' as const }))
  }

  async getUpcomingMovies() {
    const data = await this.request<{ results: TMDbTitle[] }>('/movie/upcoming')
    return data.results.map((item) => ({ ...item, media_type: 'movie' as const }))
  }

  async getGenres(type: MediaType) {
    const data = await this.request<{ genres: TMDbGenre[] }>(`/genre/${type}/list`)
    return data.genres
  }

  async discoverMedia(type: MediaType, params: Record<string, string> = {}) {
    const data = await this.request<{ results: TMDbTitle[] }>(`/discover/${type}`, params)
    return data.results.map((item) => ({ ...item, media_type: type }))
  }

  async getMovieDetails(movieId: number) {
    return this.request<TMDbMovie>(`/movie/${movieId}`, { append_to_response: 'external_ids' })
  }

  async getTVDetails(tvId: number) {
    return this.request<TMDbTVShow>(`/tv/${tvId}`, { append_to_response: 'external_ids' })
  }

  async getMovieCredits(movieId: number) {
    return this.request<TMDbCredits>(`/movie/${movieId}/credits`)
  }

  async getTVCredits(tvId: number) {
    return this.request<TMDbCredits>(`/tv/${tvId}/credits`)
  }

  async getSeasonDetails(tvId: number, seasonNumber: number) {
    return this.request<{ episodes: TMDbEpisode[] } & import('./types').TMDbSeason>(
      `/tv/${tvId}/season/${seasonNumber}`
    )
  }

  async getMediaImages(type: 'movie' | 'tv', id: number) {
    return this.request<{
      backdrops: TMDbImage[]
      posters: TMDbImage[]
      logos: TMDbImage[]
    }>(`/${type}/${id}/images`, { include_image_language: 'en,null' })
  }

  async getPersonDetails(personId: number) {
    return this.request<TMDbPerson>(`/person/${personId}`, {
      append_to_response: 'combined_credits,external_ids',
    })
  }

  getImageUrl(path: string | null, size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500') {
    if (!path) return null
    if (path.startsWith('http')) return path
    return `${TMDB_IMAGE_BASE}/${size}${path}`
  }

  getBackdropUrl(
    path: string | null,
    size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'
  ) {
    if (!path) return null
    if (path.startsWith('http')) return path
    return `${TMDB_IMAGE_BASE}/${size}${path}`
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const queryParams = new URLSearchParams({
      api_key: this.apiKey,
      language: this.language,
      ...params,
    })

    const response = await fetch(`${TMDB_API_BASE}${endpoint}?${queryParams.toString()}`)
    if (!response.ok) {
      throw new Error(`TMDb API error ${response.status}: ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }
}

export function transformMovieToTitleDetails(
  tmdb: TMDbService,
  movie: TMDbMovie,
  credits: { cast: TMDbCast[]; crew: TMDbCast[] }
): Omit<TitleDetails, 'averageRating' | 'ratingCount'> {
  const director = credits.crew.find((person) => person.job === 'Director')

  return {
    id: '',
    tmdbId: movie.id,
    type: 'movie',
    title: movie.title,
    synopsis: movie.overview || '',
    coverImage: tmdb.getImageUrl(movie.poster_path),
    backdropImage: tmdb.getBackdropUrl(movie.backdrop_path),
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
    genres: movie.genres || [],
    cast: credits.cast.slice(0, 20),
    director: director ? { ...director, job: 'Director' } : undefined,
    runtime: movie.runtime,
    externalIds: movie.external_ids,
  }
}

export function transformTVToTitleDetails(
  tmdb: TMDbService,
  tv: TMDbTVShow,
  credits: { cast: TMDbCast[]; crew: TMDbCast[] }
): Omit<TitleDetails, 'averageRating' | 'ratingCount'> {
  const creator = credits.crew.find((person) => person.job === 'Creator')

  return {
    id: '',
    tmdbId: tv.id,
    type: 'tv',
    title: tv.name,
    synopsis: tv.overview || '',
    coverImage: tmdb.getImageUrl(tv.poster_path),
    backdropImage: tmdb.getBackdropUrl(tv.backdrop_path),
    year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : 0,
    genres: tv.genres || [],
    cast: credits.cast.slice(0, 20),
    director: creator ? { ...creator, job: 'Creator' } : undefined,
    totalSeasons: tv.number_of_seasons,
    totalEpisodes: tv.number_of_episodes,
    seasons: tv.seasons,
    externalIds: tv.external_ids,
  }
}

export function formatRuntime(minutes: number | undefined) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}
