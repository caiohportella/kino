// Database service for Supabase operations
import { supabase } from '@/utils/supabase'
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
  FollowerInfo,
} from '~/types'
import type {
  SupabaseTitle,
  SupabaseTitleRating,
  SupabaseEpisodeRating,
  SupabaseWatchDiaryEntry,
  SupabaseWatchlist,
  SupabaseWatchlistItem,
  WatchedMovie,
  WatchedSeries,
} from '~/types/supabase'

export class DatabaseService {
  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) return null
    return data
  }

  /**
   * Search users by username or display name
   */
  async searchUsers(query: string): Promise<UserProfile[]> {
    if (!query || query.length < 2) return []

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('Error searching users:', error)
      return []
    }
    return data || []
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({ id: userId, ...updates })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get watched movies
   */
  async getWatchedMovies(userId: string): Promise<WatchedMovie[]> {
    const { data, error } = await supabase
      .from('title_ratings')
      .select(
        `
        *,
        title:titles(*)
      `
      )
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })

    if (error) throw error

    // Filter out cases where title join might have failed
    return data
      .filter(
        (r): r is SupabaseTitleRating & { title: SupabaseTitle } =>
          !!r.title && r.title.type === 'movie'
      )
      .map((r) => ({
        ...r.title,
        rating: r.rating,
        watched_at: r.watched_at,
        user_rating_id: r.id,
      }))
  }

  /**
   * Get watched series
   * Groups by title and gets latest watched episode
   */
  async getWatchedSeries(userId: string): Promise<WatchedSeries[]> {
    // We get all episode ratings, order by watched_at desc
    const { data, error } = await supabase
      .from('episode_ratings')
      .select(
        `
        *,
        title:titles(*)
      `
      )
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .order('season_number', { ascending: false })
      .order('episode_number', { ascending: false })
      .limit(10000)

    if (error) throw error

    // Deduplicate by title_id to show unique series
    const uniqueSeriesMap = new Map<string, WatchedSeries & { watchedEpisodes: Set<string> }>()

    data.forEach((rating: SupabaseEpisodeRating) => {
      if (!rating.title) return

      // Track unique episodes watched per series
      const existing = uniqueSeriesMap.get(rating.title.id)
      const episodeKey = `${rating.season_number}-${rating.episode_number}`

      let watchedEpisodes = existing ? existing.watchedEpisodes : new Set<string>()
      watchedEpisodes.add(episodeKey)

      if (!existing) {
        uniqueSeriesMap.set(rating.title.id, {
          ...(rating.title as SupabaseTitle),
          total_episodes: rating.title.total_episodes || 0,
          latest_rating: rating.rating,
          latest_watched_at: rating.watched_at,
          last_episode: {
            season: rating.season_number,
            episode: rating.episode_number,
          },
          watchedEpisodes, // Set of "S-E" strings
          watched_episode_count: 0,
          next_episode: null,
          is_series_completed: false,
        })
      } else {
        // If current rating is newer, update latest stats
        if (new Date(rating.watched_at) > new Date(existing.latest_watched_at)) {
          existing.latest_rating = rating.rating
          existing.latest_watched_at = rating.watched_at
          existing.last_episode = {
            season: rating.season_number,
            episode: rating.episode_number,
          }
        }
        // Always update the set reference
        existing.watchedEpisodes = watchedEpisodes
      }
    })

    return Array.from(uniqueSeriesMap.values()).map((series) => {
      const isSeriesCompleted =
        !!series.total_episodes && series.watchedEpisodes.size === series.total_episodes

      let nextEpisode = null
      if (!isSeriesCompleted) {
        const lastSeason = series.last_episode.season
        const lastEpisode = series.last_episode.episode
        const seasonsMetadata = series.seasons_metadata as
          | { season_number: number; episode_count: number }[]
          | null

        if (seasonsMetadata && Array.isArray(seasonsMetadata)) {
          const currentSeasonData = seasonsMetadata.find((s) => s.season_number === lastSeason)

          if (currentSeasonData) {
            if (lastEpisode < currentSeasonData.episode_count) {
              // Next episode is in the same season
              nextEpisode = {
                season: lastSeason,
                episode: lastEpisode + 1,
              }
            } else {
              // Check for next season
              const nextSeasonData = seasonsMetadata.find((s) => s.season_number === lastSeason + 1)
              if (nextSeasonData) {
                nextEpisode = {
                  season: lastSeason + 1,
                  episode: 1,
                }
              }
            }
          }
        }
      }

      return {
        ...series,
        watched_episode_count: series.watchedEpisodes.size,
        watched_episode_keys: Array.from(series.watchedEpisodes),
        watchedEpisodes: undefined, // Clean up helper field
        next_episode: nextEpisode,
        is_series_completed: isSeriesCompleted,
      }
    })
  }

  /**
   * Get average season ratings for multiple TV shows.
   * Calculates the average rating for each season of a show, then averages those season averages.
   * @returns A map of titleId -> average rating.
   */
  async getAverageSeasonRatingsForTitles(
    userId: string,
    titleIds: string[]
  ): Promise<Record<string, number>> {
    if (titleIds.length === 0) {
      return {}
    }

    const { data: episodeRatings, error } = await supabase
      .from('episode_ratings')
      .select('title_id, season_number, rating')
      .eq('user_id', userId)
      .in('title_id', titleIds)
      .gt('rating', 0) // Only consider episodes with a rating

    if (error) {
      console.error('[getAverageSeasonRatingsForTitles] Error fetching episode ratings:', error)
      return {}
    }

    if (!episodeRatings) {
      return {}
    }

    // { titleId -> { seasonNumber -> { total: number, count: number } } }
    const seasonRatingData: Record<string, Record<number, { total: number; count: number }>> = {}

    for (const er of episodeRatings) {
      // Initialize data structure if it doesn't exist
      if (!seasonRatingData[er.title_id]) {
        seasonRatingData[er.title_id] = {}
      }
      if (!seasonRatingData[er.title_id][er.season_number]) {
        seasonRatingData[er.title_id][er.season_number] = {
          total: 0,
          count: 0,
        }
      }

      // Add rating to the season's total and increment count
      if (er.rating) {
        seasonRatingData[er.title_id][er.season_number].total += er.rating
        seasonRatingData[er.title_id][er.season_number].count += 1
      }
    }

    const finalAverages: Record<string, number> = {}

    for (const titleId in seasonRatingData) {
      const seasons = seasonRatingData[titleId]
      const seasonAverages: number[] = []

      for (const seasonNumber in seasons) {
        const season = seasons[seasonNumber]
        if (season.count > 0) {
          seasonAverages.push(season.total / season.count)
        }
      }

      if (seasonAverages.length > 0) {
        const totalAverage =
          seasonAverages.reduce((sum, avg) => sum + avg, 0) / seasonAverages.length
        finalAverages[titleId] = totalAverage
      }
    }

    return finalAverages
  }

  /**
   * Get or create a title in the database
   */
  async getOrCreateTitle(tmdbData: {
    tmdbId: number
    type: 'movie' | 'tv'
    title: string
    synopsis: string
    coverImage: string | null
    backdropImage: string | null
    year: number
    genres: { id: number; name: string }[]
    cast: {
      id: number
      name: string
      character?: string
      profile_path: string | null
    }[]
    director?: { id: number; name: string; profile_path: string | null }
    runtime?: number
    totalSeasons?: number
    totalEpisodes?: number
    seasons?: import('~/types').TMDbSeason[]
  }): Promise<string> {
    // Check if title exists
    const { data: existing, error: fetchError } = await supabase
      .from('titles')
      .select('id')
      .eq('tmdb_id', tmdbData.tmdbId)
      .maybeSingle()

    if (fetchError) throw fetchError

    // Process seasons metadata if available
    const seasonsMetadata =
      tmdbData.seasons?.map((season) => ({
        season_number: season.season_number,
        episode_count: season.episode_count,
        air_date: season.air_date,
      })) || []

    if (existing) {
      // Update existing title with latest metadata (crucial for adding season data to existing records)
      await supabase
        .from('titles')
        .update({
          seasons_metadata: seasonsMetadata,
          total_seasons: tmdbData.totalSeasons,
          total_episodes: tmdbData.totalEpisodes,
          // Optional: update other fields that might change over time
          cover_image: tmdbData.coverImage,
          backdrop_image: tmdbData.backdropImage,
          // rating: tmdbData.vote_average, // Removed due to TS error (not in params)
        })
        .eq('id', existing.id)

      return existing.id
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
        total_episodes: tmdbData.totalEpisodes,
        seasons_metadata: seasonsMetadata,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        const { data: retryData, error: retryError } = await supabase
          .from('titles')
          .select('id')
          .eq('tmdb_id', tmdbData.tmdbId)
          .single()

        if (retryError) throw retryError
        if (retryData) return retryData.id
      }
      throw error
    }
    return data.id
  }

  /**
   * Get title by ID
   */
  async getTitle(titleId: string): Promise<TitleDetails | null> {
    const { data, error } = await supabase.from('titles').select('*').eq('id', titleId).single()

    if (error) throw error
    if (!data) return null

    return this.mapTitleToDetails(data)
  }

  /**
   * Get title by TMDb ID
   */
  async getTitleByTmdbId(tmdbId: number): Promise<TitleDetails | null> {
    const { data, error } = await supabase.from('titles').select('*').eq('tmdb_id', tmdbId).single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null

    return this.mapTitleToDetails(data)
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
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: existing } = await supabase
      .from('title_ratings')
      .select('id')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .maybeSingle()

    let data
    let error

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
        .single()
      data = result.data
      error = result.error
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
        .single()
      data = result.data
      error = result.error
    }

    if (error) throw error
    return this.mapRating(data)
  }

  async deleteTitleRating(titleId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    await supabase.from('title_ratings').delete().eq('user_id', user.id).eq('title_id', titleId)
  }

  /**
   * Rate an episode
   */
  async rateEpisode(
    titleId: string,
    seasonNumber: number,
    episodeNumber: number,
    rating: number | null,
    watchType: 'first-time' | 'rewatch',
    watchedAt: Date,
    notes?: string
  ): Promise<EpisodeRating> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: existing } = await supabase
      .from('episode_ratings')
      .select('id')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .maybeSingle()

    let data
    let error

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
        .single()
      data = result.data
      error = result.error
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
        .single()
      data = result.data
      error = result.error
    }

    if (error) throw error
    return this.mapEpisodeRating(data)
  }

  /**
   * Remove a single episode rating (unwatch)
   */
  async removeEpisodeRating(
    titleId: string,
    seasonNumber: number,
    episodeNumber: number
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('episode_ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)

    if (error) throw error
  }

  /**
   * Mark all episodes in a season as watched
   */
  async markSeasonEpisodesAsWatched(
    titleId: string,
    seasonNumber: number,
    episodes: { season_number: number; episode_number: number }[],
    watchType: 'first-time' | 'rewatch' = 'first-time'
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const watchedAt = new Date().toISOString()

    const upsertData = episodes.map((ep) => ({
      user_id: user.id,
      title_id: titleId,
      season_number: seasonNumber,
      episode_number: ep.episode_number,
      rating: null,
      watch_type: watchType,
      watched_at: watchedAt,
    }))

    const { error } = await supabase.from('episode_ratings').upsert(upsertData, {
      onConflict: 'user_id,title_id,season_number,episode_number',
    })

    if (error) throw error
  }

  /**
   * Remove watched status for all episodes in a season
   */
  async removeSeasonEpisodesWatched(titleId: string, seasonNumber: number): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('episode_ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)

    if (error) throw error
  }

  /**
   * Get user's rating for a title
   */
  async getUserRating(titleId: string): Promise<UserRating | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('title_ratings')
      .select('*')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .order('watched_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null

    return this.mapRating(data)
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
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('episode_ratings')
      .select('*')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null

    return this.mapEpisodeRating(data)
  }

  /**
   * Get all user ratings for a specific season
   */
  async getUserSeasonRatings(titleId: string, seasonNumber: number): Promise<EpisodeRating[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('episode_ratings')
      .select('*')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)

    if (error) throw error
    return (data || []).map((item) => this.mapEpisodeRating(item))
  }

  /**
   * Get title rating statistics
   */
  async getTitleRatingStats(titleId: string): Promise<TitleRatingStats> {
    const { data, error } = await supabase.rpc('get_title_rating_stats', {
      p_title_id: titleId,
    })

    if (error) throw error

    const stats = data[0] || {
      average_rating: 0,
      total_ratings: 0,
      star_breakdown: {},
    }

    return {
      averageRating: parseFloat(stats.average_rating) || 0,
      totalRatings: parseInt(stats.total_ratings) || 0,
      starBreakdown: stats.star_breakdown || {},
    }
  }

  /**
   * Get season rating statistics
   */
  async getSeasonRatingStats(titleId: string, seasonNumber: number): Promise<SeasonRating> {
    const { data, error } = await supabase.rpc('get_season_rating_stats', {
      p_title_id: titleId,
      p_season_number: seasonNumber,
    })

    if (error) throw error

    const stats = data[0] || {
      average_rating: 0,
      rated_episodes: 0,
      total_episodes: 0,
    }

    return {
      seasonNumber,
      averageRating: parseFloat(stats.average_rating) || 0,
      episodeCount: parseInt(stats.total_episodes) || 0,
      ratedEpisodes: parseInt(stats.rated_episodes) || 0,
    }
  }

  /**
   * Get series rating statistics
   */
  async getSeriesRatingStats(titleId: string): Promise<TitleRatingStats> {
    const { data, error } = await supabase.rpc('get_series_rating_stats', {
      p_title_id: titleId,
    })

    if (error) throw error

    const stats = data[0] || {
      average_rating: 0,
      total_ratings: 0,
      star_breakdown: {},
    }

    return {
      averageRating: parseFloat(stats.average_rating) || 0,
      totalRatings: parseInt(stats.total_ratings) || 0,
      starBreakdown: stats.star_breakdown || {},
    }
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
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

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
      .single()

    if (error) throw error
    return this.mapWatchDiaryEntry(data)
  }

  /**
   * Update watch diary entry
   */
  async updateWatchDiaryEntry(
    entryId: string,
    updates: {
      watchedAt?: Date
      notes?: string
      watchType?: 'first-time' | 'rewatch'
    }
  ): Promise<WatchDiaryEntry> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const updatePayload: Partial<SupabaseWatchDiaryEntry> = {}
    if (updates.watchedAt) updatePayload.watched_at = updates.watchedAt.toISOString()
    if (updates.notes !== undefined) updatePayload.notes = updates.notes
    if (updates.watchType) updatePayload.watch_type = updates.watchType

    const { data, error } = await supabase
      .from('watch_diary')
      .update(updatePayload)
      .eq('id', entryId)
      .eq('user_id', user.id) // Security check
      .select()
      .single()

    if (error) throw error
    return this.mapWatchDiaryEntry(data)
  }

  /**
   * Delete watch diary entry
   */
  async deleteWatchDiaryEntry(entryId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('watch_diary')
      .delete()
      .eq('id', entryId)
      .eq('user_id', user.id) // Security check

    if (error) throw error
  }

  /**
   * Get last watch diary entry for a title
   */
  async getLastWatchEntry(titleId: string): Promise<WatchDiaryEntry | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('watch_diary')
      .select('*')
      .eq('user_id', user.id)
      .eq('title_id', titleId)
      .order('watched_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!data) return null

    return this.mapWatchDiaryEntry(data)
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
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    let shareCode = null
    if (isShared) {
      // Generate 8-char random alphanumeric code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      shareCode = ''
      for (let i = 0; i < 8; i++) {
        shareCode += chars.charAt(Math.floor(Math.random() * chars.length))
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
      .single()

    if (error) throw error
    return this.mapWatchlist(data)
  }

  /**
   * Add title to watchlist
   */
  async addToWatchlist(watchlistId: string, titleId: string): Promise<WatchlistItem> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({
        watchlist_id: watchlistId,
        title_id: titleId,
        added_by: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapWatchlistItem(data)
  }

  /**
   * Remove title from watchlist
   */
  async removeFromWatchlist(watchlistId: string, titleId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('watchlist_id', watchlistId)
      .eq('title_id', titleId)
      .eq('added_by', user.id)

    if (error) throw error
  }

  /**
   * Get IDs of watchlists containing a specific title
   */
  async getWatchlistsContainingTitle(titleId: string): Promise<string[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // First get all user's watchlists to filter by
    const { data: userWatchlists, error: wlError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('user_id', user.id)

    if (wlError) throw wlError

    if (!userWatchlists || userWatchlists.length === 0) return []

    const watchlistIds = userWatchlists.map((w) => w.id)

    const { data, error } = await supabase
      .from('watchlist_items')
      .select('watchlist_id')
      .eq('title_id', titleId)
      .in('watchlist_id', watchlistIds)

    if (error) throw error
    return data.map((item) => item.watchlist_id)
  }

  /**
   * Check if a title is in any of the user's watchlists (owned or shared)
   */
  async isTitleWatchlisted(titleId: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    // 1. Get all watchlist IDs accessible to the user
    // (Both owned and where user is a collaborator)
    const [ownedResponse, sharedResponse] = await Promise.all([
      supabase.from('watchlists').select('id').eq('user_id', user.id),
      supabase.from('watchlist_collaborators').select('watchlist_id').eq('user_id', user.id),
    ])

    const ownedIds = ownedResponse.data?.map((w) => w.id) || []
    const sharedIds = sharedResponse.data?.map((w) => w.watchlist_id) || []
    const allIds = [...new Set([...ownedIds, ...sharedIds])]

    if (allIds.length === 0) return false

    // 2. Check if the title is in any of these watchlists
    const { count, error } = await supabase
      .from('watchlist_items')
      .select('id', { count: 'exact', head: true })
      .eq('title_id', titleId)
      .in('watchlist_id', allIds)

    if (error) {
      console.error('Error checking watchlist status:', error)
      return false
    }

    return (count || 0) > 0
  }

  /**
   * Share watchlist with another user
   */
  async shareWatchlist(watchlistId: string, userId: string, canEdit = true): Promise<void> {
    const { error } = await supabase.from('watchlist_collaborators').insert({
      watchlist_id: watchlistId,
      user_id: userId,
      can_edit: canEdit,
    })

    if (error) throw error
  }

  /**
   * Get watchlist collaborators
   */
  async getWatchlistCollaborators(watchlistId: string): Promise<UserProfile[]> {
    // First get the collaborator user IDs
    const { data: collaborators, error: collabError } = await supabase
      .from('watchlist_collaborators')
      .select('user_id')
      .eq('watchlist_id', watchlistId)

    if (collabError) throw collabError
    if (!collaborators || collaborators.length === 0) return []

    const userIds = collaborators.map((c) => c.user_id)

    // Then fetch the profiles using the 'in' filter
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds)

    if (profileError) throw profileError

    return profiles || []
  }

  /**
   * Delete a watchlist
   */
  async deleteWatchlist(watchlistId: string): Promise<void> {
    const { error } = await supabase.from('watchlists').delete().eq('id', watchlistId)

    if (error) throw error
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
        is_shared: updates.isShared,
      })
      .eq('id', watchlistId)
      .select()
      .single()

    if (error) throw error
    return this.mapWatchlist(data)
  }

  /**
   * Get watchlist by ID
   */
  async getWatchlist(watchlistId: string): Promise<Watchlist | null> {
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('id', watchlistId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return this.mapWatchlist(data)
  }

  /**
   * Get user's watchlists
   */
  async getUserWatchlists(): Promise<Watchlist[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // 1. Get watchlists owned by user
    const { data: ownedWatchlists, error: ownedError } = await supabase
      .from('watchlists')
      .select('id')
      .eq('user_id', user.id)

    if (ownedError) throw ownedError

    // 2. Get watchlists where user is a collaborator
    const { data: sharedWatchlists, error: sharedError } = await supabase
      .from('watchlist_collaborators')
      .select('watchlist_id')
      .eq('user_id', user.id)

    if (sharedError) throw sharedError

    // 3. Combine IDs
    const ownedIds = ownedWatchlists?.map((w) => w.id) || []
    const sharedIds = sharedWatchlists?.map((w) => w.watchlist_id) || []
    const allIds = [...new Set([...ownedIds, ...sharedIds])]

    if (allIds.length === 0) return []

    // 4. Fetch details
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .in('id', allIds)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data.map((item) => this.mapWatchlist(item))
  }
  /**
   * Join a watchlist by share code
   */
  async joinWatchlistByCode(code: string): Promise<Watchlist> {
    const { data, error } = await supabase.rpc('join_watchlist', {
      p_share_code: code,
    })

    if (error) throw error

    // The RPC returns a JSON object, so we map it to our Watchlist type
    return this.mapWatchlist(data)
  }

  /**
   * Leave a watchlist
   */
  async leaveWatchlist(watchlistId: string): Promise<void> {
    const { error } = await supabase.rpc('leave_watchlist', {
      p_watchlist_id: watchlistId,
    })

    if (error) throw error
  }

  /**
   * Delete all user data (keeps account and profile intact)
   * Deletes: diary entries, watchlists (owned and participating), watched movies/series, episode ratings, title ratings
   */
  async deleteUserData(): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // 1. Delete diary entries
    const { error: diaryError } = await supabase.from('watch_diary').delete().eq('user_id', user.id)
    if (diaryError) throw diaryError

    // 2. Delete episode ratings (watched episodes)
    const { error: episodeError } = await supabase
      .from('episode_ratings')
      .delete()
      .eq('user_id', user.id)
    if (episodeError) throw episodeError

    // 3. Delete title ratings (watched movies/series)
    const { error: titleRatingError } = await supabase
      .from('title_ratings')
      .delete()
      .eq('user_id', user.id)
    if (titleRatingError) throw titleRatingError

    // 4. Leave all watchlists where user is a collaborator
    const { error: collaboratorError } = await supabase
      .from('watchlist_collaborators')
      .delete()
      .eq('user_id', user.id)
    if (collaboratorError) throw collaboratorError

    // 5. Delete all watchlists owned by user (cascade deletes items and collaborators)
    const { error: watchlistError } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', user.id)
    if (watchlistError) throw watchlistError
  }

  /**
   * Delete user account and data
   */
  async deleteUserAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_user')

    if (error) throw error
  }

  /**
   * Remove all history for a specific media (diary entries and ratings)
   */
  async removeMediaHistory(titleId: string, type: 'movie' | 'tv'): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // 1. Delete all diary entries for this title
    const { error: diaryError } = await supabase
      .from('watch_diary')
      .delete()
      .eq('user_id', user.id)
      .eq('title_id', titleId)

    if (diaryError) throw diaryError

    // 2. Delete ratings
    if (type === 'movie') {
      const { error: ratingError } = await supabase
        .from('title_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('title_id', titleId)
      if (ratingError) throw ratingError
    } else {
      const { error: ratingError } = await supabase
        .from('episode_ratings')
        .delete()
        .eq('user_id', user.id)
        .eq('title_id', titleId)
      if (ratingError) throw ratingError
    }
  }

  /**
   * Follow a user
   */
  async followUser(targetUserId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase.from('follows').insert({
      follower_id: user.id,
      following_id: targetUserId,
    })

    if (error) throw error
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(targetUserId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)

    if (error) throw error
  }

  /**
   * Remove a follower (force unfollow)
   */
  async removeFollower(followerId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', user.id)

    if (error) throw error
  }

  /**
   * Check if current user follows target user
   */
  async checkFollowStatus(targetUserId: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase
      .from('follows')
      .select('created_at')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle()

    if (error) return false
    return !!data
  }

  /**
   * Get followers for a user
   */
  /**
   * Get followers with extended info (mutual status)
   */
  async getFollowers(userId: string): Promise<FollowerInfo[]> {
    // 1. Get who follows userId
    const { data: followers, error } = await supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)

    if (error) throw error
    if (!followers || followers.length === 0) return []

    const followerIds = followers.map((f) => f.follower_id)

    // 2. Get profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', followerIds)

    if (profilesError) throw profilesError
    if (!profiles) return []

    // 3. Check which of these followers the userId ALSO follows (Mutual)
    const { data: myFollowing, error: mutualError } = await supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .in('following_id', followerIds)

    if (mutualError) throw mutualError

    const mutualMap = new Map(myFollowing?.map((f) => [f.following_id, f.created_at]) || [])

    // 4. Merge
    return profiles.map((profile) => {
      const followRecord = followers.find((f) => f.follower_id === profile.id)
      const mutualDate = mutualMap.get(profile.id)
      const followedAt = followRecord?.created_at || new Date().toISOString()

      const isMutual = !!mutualDate
      let mutualSince

      if (isMutual && mutualDate) {
        // Mutual since is the later of the two dates
        const date1 = new Date(followedAt).getTime()
        const date2 = new Date(mutualDate).getTime()
        mutualSince = new Date(Math.max(date1, date2)).toISOString()
      }

      return {
        ...profile,
        followedAt,
        isMutual,
        mutualSince,
      }
    })
  }

  /**
   * Get users followed by userId with extended info
   */
  async getFollowing(userId: string): Promise<FollowerInfo[]> {
    // 1. Get who userId follows
    const { data: following, error } = await supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)

    if (error) throw error
    if (!following || following.length === 0) return []

    const followingIds = following.map((f) => f.following_id)

    // 2. Get profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', followingIds)

    if (profilesError) throw profilesError
    if (!profiles) return []

    // 3. Check which of these users ALSO follow userId (Mutual)
    const { data: myFollowers, error: mutualError } = await supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .in('follower_id', followingIds)

    if (mutualError) throw mutualError

    const mutualMap = new Map(myFollowers?.map((f) => [f.follower_id, f.created_at]) || [])

    // 4. Merge
    return profiles.map((profile) => {
      const followRecord = following.find((f) => f.following_id === profile.id)
      const mutualDate = mutualMap.get(profile.id)
      const followedAt = followRecord?.created_at || new Date().toISOString()

      const isMutual = !!mutualDate
      let mutualSince

      if (isMutual && mutualDate) {
        const date1 = new Date(followedAt).getTime()
        const date2 = new Date(mutualDate).getTime()
        mutualSince = new Date(Math.max(date1, date2)).toISOString()
      }

      return {
        ...profile,
        followedAt,
        isMutual,
        mutualSince,
      }
    })
  }

  /**
   * Get follow counts
   */
  async getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
    const { count: followersCount, error: followersError } = await supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', userId)

    if (followersError) throw followersError

    const { count: followingCount, error: followingError } = await supabase
      .from('follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', userId)

    if (followingError) throw followingError

    return {
      followers: followersCount || 0,
      following: followingCount || 0,
    }
  }

  /**
   * Get title ratings from users the current user follows
   */
  async getFriendsRatingsForTitle(
    titleId: string
  ): Promise<
    { userId: string; displayName: string | null; username: string | null; avatarUrl: string | null; rating: number }[]
  > {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // 1. Get who I follow
    const { data: following, error: followError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (followError || !following || following.length === 0) return []

    const followingIds = following.map((f) => f.following_id)

    // 2. Get their ratings for this title
    const { data: ratings, error: ratingsError } = await supabase
      .from('title_ratings')
      .select('user_id, rating')
      .eq('title_id', titleId)
      .in('user_id', followingIds)
      .gt('rating', 0)

    if (ratingsError || !ratings || ratings.length === 0) return []

    const raterIds = ratings.map((r) => r.user_id)

    // 3. Get their profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', raterIds)

    if (profilesError || !profiles) return []

    const profileMap = new Map(profiles.map((p) => [p.id, p]))

    return ratings
      .filter((r) => profileMap.has(r.user_id))
      .map((r) => {
        const profile = profileMap.get(r.user_id)!
        return {
          userId: r.user_id,
          displayName: profile.display_name,
          username: profile.username,
          avatarUrl: profile.avatar_url,
          rating: r.rating,
        }
      })
  }

  /**
   * Get episode ratings from users the current user follows
   */
  async getFriendsEpisodeRatingsForTitle(
    titleId: string
  ): Promise<
    {
      userId: string
      displayName: string | null
      username: string | null
      avatarUrl: string | null
      seasonNumber: number
      episodeNumber: number
      rating: number
    }[]
  > {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // 1. Get who I follow
    const { data: following, error: followError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (followError || !following || following.length === 0) return []

    const followingIds = following.map((f) => f.following_id)

    // 2. Get their episode ratings for this title
    const { data: ratings, error: ratingsError } = await supabase
      .from('episode_ratings')
      .select('user_id, season_number, episode_number, rating')
      .eq('title_id', titleId)
      .in('user_id', followingIds)
      .gt('rating', 0)

    if (ratingsError || !ratings || ratings.length === 0) return []

    const raterIds = [...new Set(ratings.map((r) => r.user_id))]

    // 3. Get their profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', raterIds)

    if (profilesError || !profiles) return []

    const profileMap = new Map(profiles.map((p) => [p.id, p]))

    return ratings
      .filter((r) => profileMap.has(r.user_id))
      .map((r) => {
        const profile = profileMap.get(r.user_id)!
        return {
          userId: r.user_id,
          displayName: profile.display_name,
          username: profile.username,
          avatarUrl: profile.avatar_url,
          seasonNumber: r.season_number,
          episodeNumber: r.episode_number,
          rating: r.rating,
        }
      })
  }

  // Helper methods to map database rows to types
  private mapTitleToDetails(row: SupabaseTitle): TitleDetails {
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
      totalEpisodes: row.total_episodes,
    }
  }

  private mapRating(row: SupabaseTitleRating): UserRating {
    return {
      id: row.id,
      userId: row.user_id,
      titleId: row.title_id,
      rating: row.rating,
      watchType: row.watch_type,
      watchedAt: new Date(row.watched_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapEpisodeRating(row: SupabaseEpisodeRating): EpisodeRating {
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
    }
  }

  private mapWatchDiaryEntry(row: SupabaseWatchDiaryEntry): WatchDiaryEntry {
    return {
      id: row.id,
      userId: row.user_id,
      titleId: row.title_id,
      watchedAt: new Date(row.watched_at),
      watchType: row.watch_type,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapWatchlist(row: SupabaseWatchlist): Watchlist {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      thumbnail: row.thumbnail,
      isShared: row.is_shared,
      shareCode: row.share_code || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapWatchlistItem(row: SupabaseWatchlistItem): WatchlistItem {
    return {
      id: row.id,
      watchlistId: row.watchlist_id,
      titleId: row.title_id,
      addedAt: new Date(row.added_at),
      addedBy: row.added_by,
    }
  }
  /**
   * Upload user avatar
   */
  async uploadAvatar(uri: string): Promise<string | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const response = await fetch(uri)
      const fileData = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileData, {
          contentType: `image/${fileExt}`,
          upsert: true,
        })

      if (uploadError) {
        console.error('Upload Error Details:', uploadError)
        throw uploadError
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      throw error
    }
  }
}

export const dbService = new DatabaseService()
