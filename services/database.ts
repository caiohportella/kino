// Database service for Supabase operations
import { supabase } from '~/utils/supabase';
import type {
  TitleDetails,
  UserRating,
  EpisodeRating,
  WatchDiaryEntry,
  Watchlist,
  WatchlistItem,
  TitleRatingStats,
  SeasonRating,
  UserProfile,
} from '~/types';


export class DatabaseService {

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({ id: userId, ...updates })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get watched movies
   */
  async getWatchedMovies(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('title_ratings')
      .select(`
        *,
        title:titles(*)
      `)
      .eq('user_id', userId)
      .order('watched_at', { ascending: false });

    if (error) throw error;

    // Filter out any where title join might have failed (though theoretically shouldn't)
    // and ensure it's a movie
    return data
      .filter(r => r.title && r.title.type === 'movie')
      .map(r => ({
        ...r.title,
        rating: r.rating,
        watched_at: r.watched_at,
        user_rating_id: r.id
      }));
  }

  /**
   * Get watched series
   * Groups by title and gets latest watched episode
   */
  async getWatchedSeries(userId: string): Promise<any[]> {
    // We get all episode ratings, order by watched_at desc
    const { data, error } = await supabase
      .from('episode_ratings')
      .select(`
        *,
        title:titles(*)
      `)
      .eq('user_id', userId)
      .order('watched_at', { ascending: false });

    if (error) throw error;

    // Deduplicate by title_id to show unique series
    const uniqueSeriesMap = new Map();

    data.forEach(rating => {
      if (!rating.title) return;
      if (!uniqueSeriesMap.has(rating.title.id)) {
        uniqueSeriesMap.set(rating.title.id, {
          ...rating.title,
          latest_rating: rating.rating,
          latest_watched_at: rating.watched_at,
          last_episode: {
            season: rating.season_number,
            episode: rating.episode_number
          }
        });
      }
    });

    return Array.from(uniqueSeriesMap.values());
  }
  /**
   * Get or create a title in the database
   */
  async getOrCreateTitle(tmdbData: {
    tmdbId: number;
    type: 'movie' | 'tv';
    title: string;
    synopsis: string;
    coverImage: string | null;
    backdropImage: string | null;
    year: number;
    genres: { id: number; name: string }[];
    cast: { id: number; name: string; character?: string; profile_path: string | null }[];
    director?: { id: number; name: string; profile_path: string | null };
    runtime?: number;
    totalSeasons?: number;
  }): Promise<string> {
    // Check if title exists
    const { data: existing, error: fetchError } = await supabase
      .from('titles')
      .select('id')
      .eq('tmdb_id', tmdbData.tmdbId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      return existing.id;
    }

    // Create new title
    const { data, error } = await supabase
      .from('titles')
      .insert({
        tmdb_id: tmdbData.tmdbId,
        type: tmdbData.type,
        title: tmdbData.title,
        synopsis: tmdbData.synopsis,
        cover_image: tmdbData.coverImage,
        backdrop_image: tmdbData.backdropImage,
        release_year: tmdbData.year,
        genres: tmdbData.genres,
        cast: tmdbData.cast,
        director: tmdbData.director,
        runtime: tmdbData.runtime,
        total_seasons: tmdbData.totalSeasons,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: retryData, error: retryError } = await supabase
          .from('titles')
          .select('id')
          .eq('tmdb_id', tmdbData.tmdbId)
          .single();

        if (retryError) throw retryError;
        if (retryData) return retryData.id;
      }
      throw error;
    }
    return data.id;
  }

  /**
   * Get title by ID
   */
  async getTitle(titleId: string): Promise<TitleDetails | null> {
    const { data, error } = await supabase.from('titles').select('*').eq('id', titleId).single();

    if (error) throw error;
    if (!data) return null;

    return this.mapTitleToDetails(data);
  }

  /**
   * Get title by TMDb ID
   */
  async getTitleByTmdbId(tmdbId: number): Promise<TitleDetails | null> {
    const { data, error } = await supabase
      .from('titles')
      .select('*')
      .eq('tmdb_id', tmdbId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapTitleToDetails(data);
  }

  /**
   * Rate a title (movie or entire series)
   */
  async rateTitle(
    titleId: string,
    rating: number,
    watchType: 'first-time' | 'rewatch',
    watchedAt: Date,
    notes?: string
  ): Promise<UserRating> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: existing } = await supabase
      .from('title_ratings')
      .select('id')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      const result = await supabase
        .from('title_ratings')
        .update({
          rating,
          watch_type: watchType,
          watched_at: watchedAt.toISOString(),
          notes,
        })
        .eq('id', existing.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('title_ratings')
        .insert({
          user_id: user.id,
          title_id: titleId,
          rating,
          watch_type: watchType,
          watched_at: watchedAt.toISOString(),
          notes,
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    return this.mapRating(data);
  }

  /**
   * Rate an episode
   */
  async rateEpisode(
    titleId: string,
    seasonNumber: number,
    episodeNumber: number,
    rating: number,
    watchType: 'first-time' | 'rewatch',
    watchedAt: Date,
    notes?: string
  ): Promise<EpisodeRating> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: existing } = await supabase
      .from('episode_ratings')
      .select('id')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      const result = await supabase
        .from('episode_ratings')
        .update({
          rating,
          watch_type: watchType,
          watched_at: watchedAt.toISOString(),
          notes,
        })
        .eq('id', existing.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('episode_ratings')
        .insert({
          user_id: user.id,
          title_id: titleId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          rating,
          watch_type: watchType,
          watched_at: watchedAt.toISOString(),
          notes,
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    return this.mapEpisodeRating(data);
  }

  /**
   * Get user's rating for a title
   */
  async getUserRating(titleId: string): Promise<UserRating | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('title_ratings')
      .select('*')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .order('watched_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapRating(data);
  }

  /**
   * Get user's rating for an episode
   */
  async getUserEpisodeRating(
    titleId: string,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<EpisodeRating | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('episode_ratings')
      .select('*')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return this.mapEpisodeRating(data);
  }

  /**
   * Get title rating statistics
   */
  async getTitleRatingStats(titleId: string): Promise<TitleRatingStats> {
    const { data, error } = await supabase.rpc('get_title_rating_stats', {
      p_title_id: titleId,
    });

    if (error) throw error;

    const stats = data[0] || {
      average_rating: 0,
      total_ratings: 0,
      star_breakdown: {},
    };

    return {
      averageRating: parseFloat(stats.average_rating) || 0,
      totalRatings: parseInt(stats.total_ratings) || 0,
      starBreakdown: stats.star_breakdown || {},
    };
  }

  /**
   * Get season rating statistics
   */
  async getSeasonRatingStats(titleId: string, seasonNumber: number): Promise<SeasonRating> {
    const { data, error } = await supabase.rpc('get_season_rating_stats', {
      p_title_id: titleId,
      p_season_number: seasonNumber,
    });

    if (error) throw error;

    const stats = data[0] || {
      average_rating: 0,
      rated_episodes: 0,
      total_episodes: 0,
    };

    return {
      seasonNumber,
      averageRating: parseFloat(stats.average_rating) || 0,
      episodeCount: parseInt(stats.total_episodes) || 0,
      ratedEpisodes: parseInt(stats.rated_episodes) || 0,
    };
  }

  /**
   * Add entry to watch diary
   */
  async addWatchDiaryEntry(
    titleId: string,
    watchedAt: Date,
    watchType: 'first-time' | 'rewatch',
    notes?: string
  ): Promise<WatchDiaryEntry> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('watch_diary')
      .insert({
        user_id: user.id,
        title_id: titleId,
        watched_at: watchedAt.toISOString(),
        watch_type: watchType,
        notes,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapWatchDiaryEntry(data);
  }

  /**
   * Create a watchlist
   */
  async createWatchlist(
    name: string,
    description?: string,
    thumbnail?: string,
    isShared = false
  ): Promise<Watchlist> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let shareCode = null;
    if (isShared) {
      // Generate 8-char random alphanumeric code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      shareCode = '';
      for (let i = 0; i < 8; i++) {
        shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    const { data, error } = await supabase
      .from('watchlists')
      .insert({
        user_id: user.id,
        name,
        description,
        thumbnail,
        is_shared: isShared,
        share_code: shareCode,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapWatchlist(data);
  }

  /**
   * Add title to watchlist
   */
  async addToWatchlist(watchlistId: string, titleId: string): Promise<WatchlistItem> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        title_id: titleId,
        added_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapWatchlistItem(data);
  }

  /**
   * Remove title from watchlist
   */
  async removeFromWatchlist(watchlistId: string, titleId: string): Promise<void> {
    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('watchlist_id', watchlistId)
      .eq('title_id', titleId);

    if (error) throw error;
  }

  /**
   * Get IDs of watchlists containing a specific title
   */
  async getWatchlistsContainingTitle(titleId: string): Promise<string[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First get all user's watchlists to filter by
    const { data: userWatchlists, error: wlError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('user_id', user.id);

    if (wlError) throw wlError;

    if (!userWatchlists || userWatchlists.length === 0) return [];

    const watchlistIds = userWatchlists.map(w => w.id);

    const { data, error } = await supabase
      .from('watchlist_items')
      .select('watchlist_id')
      .eq('title_id', titleId)
      .in('watchlist_id', watchlistIds);

    if (error) throw error;
    return data.map(item => item.watchlist_id);
  }

  /**
   * Share watchlist with another user
   */
  async shareWatchlist(watchlistId: string, userId: string, canEdit = true): Promise<void> {
    const { error } = await supabase.from('watchlist_collaborators').insert({
      watchlist_id: watchlistId,
      user_id: userId,
      can_edit: canEdit,
    });

    if (error) throw error;
  }

  /**
   * Delete a watchlist
   */
  async deleteWatchlist(watchlistId: string): Promise<void> {
    const { error } = await supabase
      .from('watchlists')
      .delete()
      .eq('id', watchlistId);

    if (error) throw error;
  }

  /**
   * Update a watchlist
   */
  async updateWatchlist(watchlistId: string, updates: Partial<Watchlist>): Promise<Watchlist> {
    const { data, error } = await supabase
      .from('watchlists')
      .update({
        name: updates.name,
        description: updates.description,
        thumbnail: updates.thumbnail,
        is_shared: updates.isShared
      })
      .eq('id', watchlistId)
      .select()
      .single();

    if (error) throw error;
    return this.mapWatchlist(data);
  }

  /**
   * Get watchlist by ID
   */
  async getWatchlist(watchlistId: string): Promise<Watchlist | null> {
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('id', watchlistId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return this.mapWatchlist(data);
  }

  /**
   * Get user's watchlists
   */
  async getUserWatchlists(): Promise<Watchlist[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data.map((item) => this.mapWatchlist(item));
  }

  // Helper methods to map database rows to types
  private mapTitleToDetails(row: any): TitleDetails {
    return {
      id: row.id,
      tmdbId: row.tmdb_id,
      type: row.type,
      title: row.title,
      synopsis: row.synopsis || '',
      coverImage: row.cover_image,
      backdropImage: row.backdrop_image,
      year: row.release_year,
      genres: row.genres || [],
      cast: row.cast || [],
      director: row.director,
      averageRating: 0, // Will be fetched separately
      ratingCount: 0, // Will be fetched separately
      runtime: row.runtime,
      totalSeasons: row.total_seasons,
    };
  }

  private mapRating(row: any): UserRating {
    return {
      id: row.id,
      userId: row.user_id,
      titleId: row.title_id,
      rating: row.rating,
      watchType: row.watch_type,
      watchedAt: new Date(row.watched_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapEpisodeRating(row: any): EpisodeRating {
    return {
      id: row.id,
      userId: row.user_id,
      titleId: row.title_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      rating: row.rating,
      watchType: row.watch_type,
      watchedAt: new Date(row.watched_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapWatchDiaryEntry(row: any): WatchDiaryEntry {
    return {
      id: row.id,
      userId: row.user_id,
      titleId: row.title_id,
      watchedAt: new Date(row.watched_at),
      watchType: row.watch_type,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapWatchlist(row: any): Watchlist {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      thumbnail: row.thumbnail,
      isShared: row.is_shared,
      shareCode: row.share_code,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapWatchlistItem(row: any): WatchlistItem {
    return {
      id: row.id,
      watchlistId: row.watchlist_id,
      titleId: row.title_id,
      addedAt: new Date(row.added_at),
      addedBy: row.added_by,
    };
  }
  /**
   * Upload user avatar
   */
  async uploadAvatar(uri: string): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const response = await fetch(uri);
      const fileData = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileData, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload Error Details:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {

      throw error;
    }
  }
}

export const dbService = new DatabaseService();
