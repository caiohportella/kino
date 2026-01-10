// TMDb API Service
// Documentation: https://developer.themoviedb.org/docs

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export class TMDbService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryParams = new URLSearchParams({
      api_key: this.apiKey,
      ...params,
    });

    const url = `${TMDB_API_BASE}${endpoint}?${queryParams}`;
    const response = await fetch(url);

    if (!response.ok) {
      let errorMessage = `TMDb API error: ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('TMDb API Error Data:', errorData);
        if (errorData.status_message) {
          errorMessage += ` - ${errorData.status_message}`;
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          errorMessage += ` - ${errorData.errors.join(', ')}`;
        }
      } catch (e) {
        // Could not parse JSON, append status text if available
        if (response.statusText) {
          errorMessage += ` ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Search for movies and TV shows
   */
  async search(
    query: string,
    page = 1
  ): Promise<{
    results: import('../types').TMDbTitle[];
    total_pages: number;
    total_results: number;
  }> {
    const multiSearch = await this.fetch<{
      results: (import('../types').TMDbTitle & { media_type: string })[];
      total_pages: number;
      total_results: number;
    }>('/search/multi', {
      query,
      page: page.toString(),
    });

    // Filter to only movies and TV shows
    const filtered = multiSearch.results.filter(
      (item) => item.media_type === 'movie' || item.media_type === 'tv'
    );

    return {
      ...multiSearch,
      results: filtered,
    };
  }

  /**
   * Get trending movies and TV shows
   */
  async getTrending(
    type: 'all' | 'movie' | 'tv' = 'all',
    timeWindow: 'day' | 'week' = 'day'
  ): Promise<(import('../types').TMDbTitle & { media_type: string })[]> {
    const response = await this.fetch<{
      results: (import('../types').TMDbTitle & { media_type: string })[];
    }>(`/trending/${type}/${timeWindow}`);
    return response.results;
  }

  /**
   * Get top rated movies
   */
  async getTopRatedMovies(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>('/movie/top_rated');
    return response.results.map((item) => ({ ...item, media_type: 'movie' }));
  }

  /**
   * Get top rated TV shows
   */
  async getTopRatedTV(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>('/tv/top_rated');
    return response.results.map((item) => ({ ...item, media_type: 'tv' }));
  }

  /**
   * Get popular movies
   */
  async getPopularMovies(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>('/movie/popular');
    return response.results.map((item) => ({ ...item, media_type: 'movie' }));
  }

  /**
   * Get popular TV shows
   */
  async getPopularTV(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>('/tv/popular');
    return response.results.map((item) => ({ ...item, media_type: 'tv' }));
  }

  /**
   * Get now playing movies
   */
  async getNowPlayingMovies(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>('/movie/now_playing');
    return response.results.map((item) => ({ ...item, media_type: 'movie' }));
  }

  /**
   * Get on the air TV shows (New Releases equivalent)
   */
  async getOnTheAirTV(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>('/tv/on_the_air');
    return response.results.map((item) => ({ ...item, media_type: 'tv' }));
  }

  /**
   * Get upcoming movies
   */
  async getUpcomingMovies(): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>('/movie/upcoming');
    return response.results.map((item) => ({ ...item, media_type: 'movie' }));
  }

  /**
   * Get genres for movies or TV shows
   */
  async getGenres(type: 'movie' | 'tv'): Promise<import('../types').TMDbGenre[]> {
    const response = await this.fetch<{
      genres: import('../types').TMDbGenre[];
    }>(`/genre/${type}/list`);
    return response.genres;
  }

  /**
   * Discover movies or TV shows by genre or other filters
   */
  async discoverMedia(
    type: 'movie' | 'tv',
    params: Record<string, string> = {}
  ): Promise<import('../types').TMDbTitle[]> {
    const response = await this.fetch<{
      results: import('../types').TMDbTitle[];
    }>(`/discover/${type}`, params);
    return response.results.map((item) => ({ ...item, media_type: type }));
  }

  /**
   * Get movie details
   */
  async getMovieDetails(movieId: number): Promise<
    import('../types').TMDbMovie & {
      genres: import('../types').TMDbGenre[];
      runtime: number;
    }
  > {
    return this.fetch(`/movie/${movieId}`);
  }

  /**
   * Get TV show details
   */
  async getTVDetails(tvId: number): Promise<
    import('../types').TMDbTVShow & {
      genres: import('../types').TMDbGenre[];
      number_of_seasons: number;
      number_of_episodes: number;
    }
  > {
    return this.fetch(`/tv/${tvId}`);
  }

  /**
   * Get movie credits (cast and crew)
   */
  async getMovieCredits(movieId: number): Promise<{
    cast: import('../types').TMDbCast[];
    crew: import('../types').TMDbCast[];
  }> {
    return this.fetch(`/movie/${movieId}/credits`);
  }

  /**
   * Get TV show credits (cast and crew)
   */
  async getTVCredits(tvId: number): Promise<{
    cast: import('../types').TMDbCast[];
    crew: import('../types').TMDbCast[];
  }> {
    return this.fetch(`/tv/${tvId}/credits`);
  }

  /**
   * Get TV show season details
   */
  async getSeasonDetails(
    tvId: number,
    seasonNumber: number
  ): Promise<
    import('../types').TMDbSeason & {
      episodes: import('../types').TMDbEpisode[];
    }
  > {
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}`);
  }

  /**
   * Get TV show episode details
   */
  async getEpisodeDetails(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<import('../types').TMDbEpisode> {
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);
  }

  /**
   * Get image URL
   */
  getImageUrl(
    path: string | null,
    size: 'w200' | 'w300' | 'w500' | 'w780' | 'original' = 'w500'
  ): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }

  /**
   * Get backdrop image URL
   */
  getBackdropUrl(
    path: string | null,
    size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'
  ): string | null {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }
}

// Singleton instance - will be initialized with API key from env
let tmdbServiceInstance: TMDbService | null = null;

export function getTMDbService(): TMDbService {
  if (!tmdbServiceInstance) {
    const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_TMDB_API_KEY is not set in environment variables');
    }
    tmdbServiceInstance = new TMDbService(apiKey);
  }
  return tmdbServiceInstance;
}
