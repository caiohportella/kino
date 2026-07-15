import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  EpisodeRating,
  FollowerInfo,
  MediaType,
  PersistedTitle,
  SeasonMetadata,
  TMDbCast,
  TMDbGenre,
  TMDbSeason,
  TitleDetails,
  TitleRatingStats,
  UIDiaryEntry,
  UserProfile,
  UserRating,
  WatchDiaryEntry,
  WatchType,
  WatchedMovie,
  WatchedSeries,
  Watchlist,
  WatchlistItem,
  WatchlistItemDetails,
} from './types'
import { findFirstUnwatchedEpisode, getEpisodeKey } from './use-cases'

type SupabaseErrorLike = { code?: string }

function toSafeCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? count : 0
}

interface TitleRow {
  id: string
  tmdb_id: number
  type: MediaType
  title: string
  synopsis: string | null
  cover_image: string | null
  backdrop_image: string | null
  release_year: number
  genres: TMDbGenre[] | null
  cast: TMDbCast[] | null
  director: TMDbCast | null
  runtime: number | null
  total_seasons: number | null
  total_episodes: number | null
  seasons_metadata?: SeasonMetadata[] | null
}

interface TitleRatingRow {
  id: string
  user_id: string
  title_id: string
  rating: number | null
  watch_type: WatchType
  watched_at: string
  notes?: string | null
  created_at: string
  updated_at: string
  title?: TitleRow | null
}

interface EpisodeRatingRow {
  id: string
  user_id: string
  title_id: string
  season_number: number
  episode_number: number
  rating: number | null
  watch_type: WatchType
  watched_at: string
  notes?: string | null
  created_at: string
  updated_at: string
  title?: TitleRow | null
}

interface WatchDiaryRow {
  id: string
  user_id: string
  title_id: string
  watched_at: string
  watch_type: WatchType
  notes: string | null
  created_at: string
  updated_at: string
  titles?: Pick<
    TitleRow,
    'title' | 'release_year' | 'cover_image' | 'tmdb_id' | 'type' | 'genres' | 'runtime'
  > | null
}

interface WatchlistRow {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail: string | null
  is_shared: boolean
  share_code: string | null
  created_at: string
  updated_at: string
}

interface WatchlistItemRow {
  id: string
  watchlist_id: string
  title_id: string
  added_by: string
  added_at: string
  title?: TitleRow | null
  added_by_user?: Pick<UserProfile, 'id' | 'avatar_url' | 'display_name' | 'username'> | null
}

interface RatingStatsRow {
  average_rating: number | string | null
  total_ratings: number | string | null
  star_breakdown: Record<number, number> | null
}

export class KinoDatabaseService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getUserProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    return (data ?? null) as UserProfile | null
  }

  async getUserProfileByUsername(username: string) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .ilike('username', username.trim())
      .maybeSingle()

    if (error) throw error
    return (data ?? null) as UserProfile | null
  }

  async searchUsers(query: string) {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) return []

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const filters = [`username.ilike.%${trimmedQuery}%`, `display_name.ilike.%${trimmedQuery}%`]
    if (uuidPattern.test(trimmedQuery)) filters.push(`id.eq.${trimmedQuery}`)

    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .or(filters.join(','))
      .limit(20)

    if (error) throw error
    return (data ?? []) as UserProfile[]
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .upsert({ id: userId, ...updates })
      .select()
      .single()

    if (error) throw error
    return data as UserProfile
  }

  async uploadAvatar(file: File, userId: string) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${userId}/${Date.now()}.${extension}`
    const { error } = await this.supabase.storage.from('avatars').upload(filePath, file, {
      contentType: file.type || `image/${extension}`,
      upsert: true,
    })

    if (error) throw error
    return this.supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl
  }

  async getWatchedMovies(userId: string) {
    const { data, error } = await this.supabase
      .from('title_ratings')
      .select('*, title:titles(*)')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })

    if (error) throw error
    const rows = (data ?? []) as TitleRatingRow[]

    return rows
      .filter((row): row is TitleRatingRow & { title: TitleRow } => row.title?.type === 'movie')
      .map((row) => ({
        ...this.mapPersistedTitle(row.title),
        type: 'movie' as const,
        rating: row.rating ?? 0,
        watched_at: row.watched_at,
        user_rating_id: row.id,
      }))
  }

  async getWatchedSeries(userId: string) {
    const { data, error } = await this.supabase
      .from('episode_ratings')
      .select('*, title:titles(*)')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .order('season_number', { ascending: false })
      .order('episode_number', { ascending: false })
      .limit(10000)

    if (error) throw error
    const rows = (data ?? []) as EpisodeRatingRow[]
    const byTitle = new Map<
      string,
      WatchedSeries & {
        watchedEpisodeKeys: Set<string>
      }
    >()

    for (const row of rows) {
      if (!row.title || row.title.type !== 'tv') continue
      const existing = byTitle.get(row.title.id)
      const key = getEpisodeKey(row.season_number, row.episode_number)
      const title = this.mapPersistedTitle(row.title)

      if (!existing) {
        byTitle.set(row.title.id, {
          ...title,
          type: 'tv',
          watched_episode_count: 0,
          latest_rating: row.rating,
          latest_watched_at: row.watched_at,
          last_episode: { season: row.season_number, episode: row.episode_number },
          next_episode: null,
          is_series_completed: false,
          watchedEpisodeKeys: new Set([key]),
        })
        continue
      }

      existing.watchedEpisodeKeys.add(key)
      if (new Date(row.watched_at) > new Date(existing.latest_watched_at)) {
        existing.latest_rating = row.rating
        existing.latest_watched_at = row.watched_at
        existing.last_episode = { season: row.season_number, episode: row.episode_number }
      }
    }

    return Array.from(byTitle.values()).map((series) => {
      const watchedCount = series.watchedEpisodeKeys.size
      const totalEpisodes = series.total_episodes || 0
      const firstUnwatchedEpisode = findFirstUnwatchedEpisode(
        series.seasons_metadata,
        series.watchedEpisodeKeys
      )
      const hasSeasonMetadata = Boolean(
        series.seasons_metadata?.some(
          (season) => season.season_number > 0 && season.episode_count > 0
        )
      )
      const completed =
        totalEpisodes > 0 &&
        (hasSeasonMetadata ? !firstUnwatchedEpisode : watchedCount >= totalEpisodes)
      const nextEpisode = completed ? null : firstUnwatchedEpisode
      const { watchedEpisodeKeys: _watchedEpisodeKeys, ...cleanSeries } = series

      return {
        ...cleanSeries,
        watched_episode_count: watchedCount,
        watched_episode_keys: Array.from(series.watchedEpisodeKeys),
        next_episode: nextEpisode,
        is_series_completed: completed,
      }
    })
  }

  async getPublicProfileStatsByUsername(username: string) {
    const { data, error } = await this.supabase.rpc('get_public_profile_og_data', {
      profile_username: username,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      diaryEntries: toSafeCount(row.diary_entries),
      moviesWatched: toSafeCount(row.movies_watched),
      seriesWatched: toSafeCount(row.series_watched),
    }
  }

  async getDiaryEntries(userId: string, limit?: number) {
    const pageSize = 1000
    const maxRows = limit ?? Number.POSITIVE_INFINITY
    const rows: WatchDiaryRow[] = []

    for (let offset = 0; rows.length < maxRows; offset += pageSize) {
      const remaining = maxRows - rows.length
      const fetchSize = Number.isFinite(remaining) ? Math.min(pageSize, remaining) : pageSize
      const { data, error } = await this.supabase
        .from('watch_diary')
        .select(
          `
          id,
          user_id,
          title_id,
          watched_at,
          watch_type,
          notes,
          created_at,
          updated_at,
          titles:title_id (
            title,
            release_year,
            cover_image,
            tmdb_id,
            type,
            genres,
            runtime
          )
        `
        )
        .eq('user_id', userId)
        .order('watched_at', { ascending: false })
        .range(offset, offset + fetchSize - 1)

      if (error) throw error

      const pageRows = (
        (data ?? []) as unknown as Array<
          Omit<WatchDiaryRow, 'titles'> & {
            titles?: WatchDiaryRow['titles'] | WatchDiaryRow['titles'][]
          }
        >
      ).map<WatchDiaryRow>((entry) => ({
        ...entry,
        titles: Array.isArray(entry.titles) ? (entry.titles[0] ?? null) : (entry.titles ?? null),
      }))

      rows.push(...pageRows)
      if (pageRows.length < fetchSize) break
    }

    const movieTitleIds = rows
      .filter((entry) => entry.titles?.type === 'movie')
      .map((entry) => entry.title_id)
    const tvTitleIds = rows
      .filter((entry) => entry.titles?.type === 'tv')
      .map((entry) => entry.title_id)
    const ratings: Record<string, number> = {}

    if (movieTitleIds.length > 0) {
      const { data: movieRatings, error: ratingsError } = await this.supabase
        .from('title_ratings')
        .select('title_id, rating')
        .eq('user_id', userId)
        .in('title_id', movieTitleIds)

      if (ratingsError) throw ratingsError
      for (const row of (movieRatings ?? []) as Pick<TitleRatingRow, 'title_id' | 'rating'>[]) {
        ratings[row.title_id] = row.rating ?? 0
      }
    }

    if (tvTitleIds.length > 0) {
      Object.assign(ratings, await this.getAverageSeasonRatingsForTitles(userId, tvTitleIds))
    }

    const allTitleIds = Array.from(new Set(rows.map((entry) => entry.title_id)))
    const communityStats: Record<string, { total: number; count: number; users: Set<string> }> = {}
    const addCommunityRating = (titleId: string, rating: number | null, ratingUserId: string) => {
      if (!rating || rating <= 0) return
      const stats = communityStats[titleId] ?? { total: 0, count: 0, users: new Set<string>() }
      stats.total += rating
      stats.count += 1
      stats.users.add(ratingUserId)
      communityStats[titleId] = stats
    }

    if (allTitleIds.length > 0) {
      const [
        { data: communityMovieRatings, error: movieStatsError },
        { data: communityEpisodeRatings, error: episodeStatsError },
      ] = await Promise.all([
        this.supabase
          .from('title_ratings')
          .select('title_id, user_id, rating')
          .in('title_id', allTitleIds),
        this.supabase
          .from('episode_ratings')
          .select('title_id, user_id, rating')
          .in('title_id', allTitleIds),
      ])
      if (movieStatsError) throw movieStatsError
      if (episodeStatsError) throw episodeStatsError

      for (const row of (communityMovieRatings ?? []) as Pick<
        TitleRatingRow,
        'title_id' | 'user_id' | 'rating'
      >[]) {
        addCommunityRating(row.title_id, row.rating, row.user_id)
      }
      for (const row of (communityEpisodeRatings ?? []) as Pick<
        EpisodeRatingRow,
        'title_id' | 'user_id' | 'rating'
      >[]) {
        addCommunityRating(row.title_id, row.rating, row.user_id)
      }
    }

    return rows.map<UIDiaryEntry>((entry) => {
      const stats = communityStats[entry.title_id]
      return {
        id: entry.id,
        titleId: entry.title_id,
        tmdbId: entry.titles?.tmdb_id ?? 0,
        type: entry.titles?.type ?? 'movie',
        titleName: entry.titles?.title || 'Unknown title',
        releaseYear: entry.titles?.release_year ?? 0,
        coverImage: entry.titles?.cover_image ?? null,
        genres: entry.titles?.genres ?? [],
        runtime: entry.titles?.runtime ?? undefined,
        watchedAt: entry.watched_at,
        watchType: entry.watch_type,
        notes: entry.notes ?? undefined,
        rating: ratings[entry.title_id] || 0,
        averageRating: stats ? stats.total / stats.count : 0,
        ratingCount: stats?.users.size ?? 0,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }
    })
  }

  async getAverageSeasonRatingsForTitles(userId: string, titleIds: string[]) {
    if (titleIds.length === 0) return {}

    const { data, error } = await this.supabase
      .from('episode_ratings')
      .select('title_id, season_number, rating')
      .eq('user_id', userId)
      .in('title_id', titleIds)
      .gt('rating', 0)

    if (error) throw error
    const rows = (data ?? []) as Pick<EpisodeRatingRow, 'title_id' | 'season_number' | 'rating'>[]
    const byTitleAndSeason: Record<string, Record<number, { total: number; count: number }>> = {}

    for (const row of rows) {
      if (row.rating === null) continue
      let seasons = byTitleAndSeason[row.title_id]
      if (!seasons) {
        seasons = {}
        byTitleAndSeason[row.title_id] = seasons
      }
      let bucket = seasons[row.season_number]
      if (!bucket) {
        bucket = { total: 0, count: 0 }
        seasons[row.season_number] = bucket
      }
      bucket.total += row.rating
      bucket.count += 1
    }

    const averages: Record<string, number> = {}
    for (const [titleId, seasons] of Object.entries(byTitleAndSeason)) {
      const seasonAverages = Object.values(seasons).map((season) => season.total / season.count)
      averages[titleId] =
        seasonAverages.reduce((total, value) => total + value, 0) / seasonAverages.length
    }

    return averages
  }

  async getOrCreateTitle(title: Omit<TitleDetails, 'averageRating' | 'ratingCount'>) {
    const { data: existing, error: fetchError } = await this.supabase
      .from('titles')
      .select('id')
      .eq('tmdb_id', title.tmdbId)
      .maybeSingle()

    if (fetchError) throw fetchError
    const existingRow = existing as { id: string } | null
    const seasonsMetadata =
      title.seasons?.map((season) => ({
        season_number: season.season_number,
        episode_count: season.episode_count,
        air_date: season.air_date,
      })) || []

    if (existingRow) {
      await this.supabase
        .from('titles')
        .update({
          cover_image: title.coverImage,
          backdrop_image: title.backdropImage,
          total_seasons: title.totalSeasons,
          total_episodes: title.totalEpisodes,
          seasons_metadata: seasonsMetadata,
        })
        .eq('id', existingRow.id)
      return existingRow.id
    }

    const { data, error } = await this.supabase
      .from('titles')
      .insert({
        tmdb_id: title.tmdbId,
        type: title.type,
        title: title.title,
        synopsis: title.synopsis,
        cover_image: title.coverImage,
        backdrop_image: title.backdropImage,
        release_year: title.year,
        genres: title.genres,
        cast: title.cast,
        director: title.director,
        runtime: title.runtime,
        total_seasons: title.totalSeasons,
        total_episodes: title.totalEpisodes,
        seasons_metadata: seasonsMetadata,
      })
      .select('id')
      .single()

    if (error) {
      if ((error as SupabaseErrorLike).code === '23505') {
        const { data: retry, error: retryError } = await this.supabase
          .from('titles')
          .select('id')
          .eq('tmdb_id', title.tmdbId)
          .single()
        if (retryError) throw retryError
        return (retry as { id: string }).id
      }
      throw error
    }

    return (data as { id: string }).id
  }

  async getTitleByTmdbId(tmdbId: number) {
    const { data, error } = await this.supabase
      .from('titles')
      .select('*')
      .eq('tmdb_id', tmdbId)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapTitleToDetails(data as TitleRow) : null
  }

  async rateTitle(
    titleId: string,
    rating: number,
    watchType: WatchType,
    watchedAt: Date,
    notes?: string
  ) {
    const user = await this.getRequiredUserId()
    const { data: existing } = await this.supabase
      .from('title_ratings')
      .select('id')
      .eq('user_id', user)
      .eq('title_id', titleId)
      .maybeSingle()

    const payload = {
      rating,
      watch_type: watchType,
      watched_at: watchedAt.toISOString(),
      notes,
    }

    const query = existing
      ? this.supabase
          .from('title_ratings')
          .update(payload)
          .eq('id', (existing as { id: string }).id)
      : this.supabase.from('title_ratings').insert({ ...payload, user_id: user, title_id: titleId })

    const { data, error } = await query.select().single()
    if (error) throw error
    return this.mapRating(data as TitleRatingRow)
  }

  async deleteTitleRating(titleId: string) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('title_ratings')
      .delete()
      .eq('user_id', user)
      .eq('title_id', titleId)

    if (error) throw error
  }

  async rateEpisode(
    titleId: string,
    seasonNumber: number,
    episodeNumber: number,
    rating: number | null,
    watchType: WatchType,
    watchedAt: Date,
    notes?: string
  ) {
    const user = await this.getRequiredUserId()
    const { data: existing } = await this.supabase
      .from('episode_ratings')
      .select('id')
      .eq('user_id', user)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)
      .maybeSingle()

    const payload = {
      rating,
      watch_type: watchType,
      watched_at: watchedAt.toISOString(),
      notes,
    }

    const query = existing
      ? this.supabase
          .from('episode_ratings')
          .update(payload)
          .eq('id', (existing as { id: string }).id)
      : this.supabase.from('episode_ratings').insert({
          ...payload,
          user_id: user,
          title_id: titleId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
        })

    const { data, error } = await query.select().single()
    if (error) throw error
    return this.mapEpisodeRating(data as EpisodeRatingRow)
  }

  async removeEpisodeRating(titleId: string, seasonNumber: number, episodeNumber: number) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('episode_ratings')
      .delete()
      .eq('user_id', user)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)
      .eq('episode_number', episodeNumber)

    if (error) throw error
  }

  async markSeasonEpisodesAsWatched(
    titleId: string,
    seasonNumber: number,
    episodes: Array<{ episode_number: number }>,
    watchType: WatchType,
    watchedAt = new Date(),
    rating: number | null = null
  ) {
    if (episodes.length === 0) return []

    const user = await this.getRequiredUserId()
    const existingByEpisode = new Map<
      number,
      Pick<EpisodeRatingRow, 'rating' | 'watch_type' | 'watched_at'>
    >()

    if (rating === null) {
      const { data: existing, error: existingError } = await this.supabase
        .from('episode_ratings')
        .select('episode_number, rating, watch_type, watched_at')
        .eq('user_id', user)
        .eq('title_id', titleId)
        .eq('season_number', seasonNumber)

      if (existingError) throw existingError
      for (const row of (existing ?? []) as Pick<
        EpisodeRatingRow,
        'episode_number' | 'rating' | 'watch_type' | 'watched_at'
      >[]) {
        existingByEpisode.set(row.episode_number, row)
      }
    }

    const payload = episodes.map((episode) => ({
      user_id: user,
      title_id: titleId,
      season_number: seasonNumber,
      episode_number: episode.episode_number,
      rating: rating ?? existingByEpisode.get(episode.episode_number)?.rating ?? null,
      watch_type: existingByEpisode.get(episode.episode_number)?.watch_type ?? watchType,
      watched_at:
        existingByEpisode.get(episode.episode_number)?.watched_at ?? watchedAt.toISOString(),
    }))

    const { data, error } = await this.supabase
      .from('episode_ratings')
      .upsert(payload, { onConflict: 'user_id,title_id,season_number,episode_number' })
      .select()

    if (error) throw error
    return ((data ?? []) as EpisodeRatingRow[]).map((row) => this.mapEpisodeRating(row))
  }

  async removeSeasonEpisodesWatched(titleId: string, seasonNumber: number) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('episode_ratings')
      .delete()
      .eq('user_id', user)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)

    if (error) throw error
  }

  async getUserRating(titleId: string) {
    const user = await this.getUserId()
    if (!user) return null

    const { data, error } = await this.supabase
      .from('title_ratings')
      .select('*')
      .eq('user_id', user)
      .eq('title_id', titleId)
      .order('watched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data ? this.mapRating(data as TitleRatingRow) : null
  }

  async getUserSeasonRatings(titleId: string, seasonNumber: number) {
    const user = await this.getUserId()
    if (!user) return []

    const { data, error } = await this.supabase
      .from('episode_ratings')
      .select('*')
      .eq('user_id', user)
      .eq('title_id', titleId)
      .eq('season_number', seasonNumber)

    if (error) throw error
    return ((data ?? []) as EpisodeRatingRow[]).map((row) => this.mapEpisodeRating(row))
  }

  async getUserTitleEpisodeRatings(titleId: string) {
    const user = await this.getUserId()
    if (!user) return []

    const { data, error } = await this.supabase
      .from('episode_ratings')
      .select('*')
      .eq('user_id', user)
      .eq('title_id', titleId)

    if (error) throw error
    return ((data ?? []) as EpisodeRatingRow[]).map((row) => this.mapEpisodeRating(row))
  }

  async getTitleRatingStats(titleId: string, type: MediaType) {
    const rpcName = type === 'tv' ? 'get_series_rating_stats' : 'get_title_rating_stats'
    const { data, error } = await this.supabase.rpc(rpcName, { p_title_id: titleId })
    if (error) throw error
    const rows = (data ?? []) as RatingStatsRow[]
    return this.mapStats(
      rows[0] ?? {
        average_rating: 0,
        total_ratings: 0,
        star_breakdown: {},
      }
    )
  }

  async addWatchDiaryEntry(titleId: string, watchedAt: Date, watchType: WatchType, notes?: string) {
    const user = await this.getRequiredUserId()
    const { data, error } = await this.supabase
      .from('watch_diary')
      .insert({
        user_id: user,
        title_id: titleId,
        watched_at: watchedAt.toISOString(),
        watch_type: watchType,
        notes,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapWatchDiaryEntry(data as WatchDiaryRow)
  }

  async updateWatchDiaryEntry(
    entryId: string,
    updates: { watchedAt?: Date; notes?: string; watchType?: WatchType }
  ) {
    const user = await this.getRequiredUserId()
    const payload: Record<string, string | undefined> = {}
    if (updates.watchedAt) payload.watched_at = updates.watchedAt.toISOString()
    if (updates.notes !== undefined) payload.notes = updates.notes
    if (updates.watchType) payload.watch_type = updates.watchType

    const { data, error } = await this.supabase
      .from('watch_diary')
      .update(payload)
      .eq('id', entryId)
      .eq('user_id', user)
      .select()
      .single()

    if (error) throw error
    return this.mapWatchDiaryEntry(data as WatchDiaryRow)
  }

  async deleteWatchDiaryEntry(entryId: string) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('watch_diary')
      .delete()
      .eq('id', entryId)
      .eq('user_id', user)
    if (error) throw error
  }

  async getLastWatchEntry(titleId: string) {
    const user = await this.getUserId()
    if (!user) return null
    const { data, error } = await this.supabase
      .from('watch_diary')
      .select('*')
      .eq('user_id', user)
      .eq('title_id', titleId)
      .order('watched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data ? this.mapWatchDiaryEntry(data as WatchDiaryRow) : null
  }

  async createWatchlist(name: string, description?: string, thumbnail?: string, isShared = false) {
    const user = await this.getRequiredUserId()
    const { data, error } = await this.supabase
      .from('watchlists')
      .insert({
        user_id: user,
        name,
        description,
        thumbnail,
        is_shared: isShared,
        share_code: isShared ? this.createShareCode() : null,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapWatchlist(data as WatchlistRow)
  }

  async updateWatchlist(watchlistId: string, updates: Partial<Watchlist>) {
    const { data, error } = await this.supabase
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
    return this.mapWatchlist(data as WatchlistRow)
  }

  async deleteWatchlist(watchlistId: string) {
    const { error } = await this.supabase.from('watchlists').delete().eq('id', watchlistId)
    if (error) throw error
  }

  async getWatchlist(watchlistId: string) {
    const { data, error } = await this.supabase
      .from('watchlists')
      .select('*')
      .eq('id', watchlistId)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapWatchlist(data as WatchlistRow) : null
  }

  async getUserWatchlists() {
    const user = await this.getRequiredUserId()
    const [{ data: owned, error: ownedError }, { data: shared, error: sharedError }] =
      await Promise.all([
        this.supabase.from('watchlists').select('id').eq('user_id', user),
        this.supabase.from('watchlist_collaborators').select('watchlist_id').eq('user_id', user),
      ])

    if (ownedError) throw ownedError
    if (sharedError) throw sharedError

    const ownedIds = ((owned ?? []) as { id: string }[]).map((row) => row.id)
    const sharedIds = ((shared ?? []) as { watchlist_id: string }[]).map((row) => row.watchlist_id)
    const allIds = [...new Set([...ownedIds, ...sharedIds])]
    if (allIds.length === 0) return []

    const { data, error } = await this.supabase
      .from('watchlists')
      .select('*')
      .in('id', allIds)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return ((data ?? []) as WatchlistRow[]).map((row) => this.mapWatchlist(row))
  }

  async getWatchlistItems(watchlistId: string) {
    const { data, error } = await this.supabase
      .from('watchlist_items')
      .select('*, title:titles(*)')
      .eq('watchlist_id', watchlistId)

    if (error) throw error
    const rows = (data ?? []) as WatchlistItemRow[]
    const userIds = [...new Set(rows.map((item) => item.added_by).filter(Boolean))]
    const profiles = await this.getProfilesByIds(userIds)

    return rows
      .filter((row): row is WatchlistItemRow & { title: TitleRow } => Boolean(row.title))
      .sort((left, right) => new Date(right.added_at).getTime() - new Date(left.added_at).getTime())
      .map<WatchlistItemDetails>((row) => ({
        ...this.mapWatchlistItem(row),
        title: this.mapPersistedTitle(row.title),
        addedByUser: profiles.get(row.added_by),
      }))
  }

  async addToWatchlist(watchlistId: string, titleId: string) {
    const user = await this.getRequiredUserId()
    const { data, error } = await this.supabase
      .from('watchlist_items')
      .insert({ watchlist_id: watchlistId, title_id: titleId, added_by: user })
      .select()
      .single()

    if (error) throw error
    return this.mapWatchlistItem(data as WatchlistItemRow)
  }

  async removeFromWatchlist(watchlistId: string, titleId: string) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('watchlist_items')
      .delete()
      .eq('watchlist_id', watchlistId)
      .eq('title_id', titleId)
      .eq('added_by', user)
    if (error) throw error
  }

  async getWatchlistTitleContributors(titleId: string) {
    const watchlists = await this.getUserWatchlists()
    if (watchlists.length === 0) return []

    const { data, error } = await this.supabase
      .from('watchlist_items')
      .select('watchlist_id, added_by')
      .eq('title_id', titleId)
      .in(
        'watchlist_id',
        watchlists.map((watchlist) => watchlist.id)
      )

    if (error) throw error
    return (data ?? []) as Array<{ watchlist_id: string; added_by: string }>
  }

  async getWatchlistsContainingTitle(titleId: string) {
    const user = await this.getUserId()
    if (!user) return []
    const watchlists = await this.getUserWatchlists()
    if (watchlists.length === 0) return []

    return (await this.getWatchlistTitleContributors(titleId)).map((row) => row.watchlist_id)
  }

  async isTitleWatchlisted(titleId: string) {
    return (await this.getWatchlistsContainingTitle(titleId)).length > 0
  }

  async getWatchlistCollaborators(watchlistId: string) {
    const { data, error } = await this.supabase
      .from('watchlist_collaborators')
      .select('user_id')
      .eq('watchlist_id', watchlistId)

    if (error) throw error
    const ids = ((data ?? []) as { user_id: string }[]).map((row) => row.user_id)
    return Array.from((await this.getProfilesByIds(ids)).values())
  }

  async joinWatchlistByCode(code: string) {
    const { data, error } = await this.supabase.rpc('join_watchlist', {
      p_share_code: code.trim().toUpperCase(),
    })
    if (error) throw error
    return this.mapWatchlist(data as WatchlistRow)
  }

  async leaveWatchlist(watchlistId: string) {
    const { error } = await this.supabase.rpc('leave_watchlist', { p_watchlist_id: watchlistId })
    if (error) throw error
  }

  async followUser(targetUserId: string) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('follows')
      .insert({ follower_id: user, following_id: targetUserId })
    if (error) throw error
  }

  async unfollowUser(targetUserId: string) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('follows')
      .delete()
      .eq('follower_id', user)
      .eq('following_id', targetUserId)
    if (error) throw error
  }

  async removeFollower(followerId: string) {
    const user = await this.getRequiredUserId()
    const { error } = await this.supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', user)

    if (error) throw error
  }

  async checkFollowStatus(targetUserId: string) {
    const user = await this.getUserId()
    if (!user) return false
    const { data, error } = await this.supabase
      .from('follows')
      .select('created_at')
      .eq('follower_id', user)
      .eq('following_id', targetUserId)
      .maybeSingle()
    if (error) throw error
    return Boolean(data)
  }

  async getFollowCounts(userId: string) {
    const [
      { count: followers, error: followersError },
      { count: following, error: followingError },
    ] = await Promise.all([
      this.supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', userId),
      this.supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ])

    if (followersError) throw followersError
    if (followingError) throw followingError
    return { followers: followers || 0, following: following || 0 }
  }

  async getFollowers(userId: string) {
    return this.getFollowList(userId, 'followers')
  }

  async getFollowing(userId: string) {
    return this.getFollowList(userId, 'following')
  }

  async removeMediaHistory(titleId: string, type: MediaType) {
    const user = await this.getRequiredUserId()
    const { error: diaryError } = await this.supabase
      .from('watch_diary')
      .delete()
      .eq('user_id', user)
      .eq('title_id', titleId)
    if (diaryError) throw diaryError

    const table = type === 'movie' ? 'title_ratings' : 'episode_ratings'
    const { error } = await this.supabase
      .from(table)
      .delete()
      .eq('user_id', user)
      .eq('title_id', titleId)
    if (error) throw error
  }

  async deleteUserData() {
    const user = await this.getRequiredUserId()
    const operations = [
      this.supabase.from('watch_diary').delete().eq('user_id', user),
      this.supabase.from('episode_ratings').delete().eq('user_id', user),
      this.supabase.from('title_ratings').delete().eq('user_id', user),
      this.supabase.from('watchlist_collaborators').delete().eq('user_id', user),
      this.supabase.from('watchlists').delete().eq('user_id', user),
    ]
    const results = await Promise.all(operations)
    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error
  }

  async deleteUserAccount() {
    const { error } = await this.supabase.rpc('delete_user')
    if (error) throw error
  }

  private async getProfilesByIds(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, UserProfile>()

    const { data, error } = await this.supabase.from('user_profiles').select('*').in('id', userIds)
    if (error) throw error
    return new Map(((data ?? []) as UserProfile[]).map((profile) => [profile.id, profile]))
  }

  private async getFollowList(userId: string, mode: 'followers' | 'following') {
    const idColumn = mode === 'followers' ? 'follower_id' : 'following_id'
    const matchColumn = mode === 'followers' ? 'following_id' : 'follower_id'
    const { data, error } = await this.supabase
      .from('follows')
      .select(`${idColumn}, created_at`)
      .eq(matchColumn, userId)

    if (error) throw error
    const rows = (data ?? []) as {
      follower_id?: string
      following_id?: string
      created_at: string
    }[]
    const ids = rows.map((row) => row[idColumn]).filter((id): id is string => Boolean(id))
    const profiles = await this.getProfilesByIds(ids)
    const mutualMap = new Map<string, string>()

    if (ids.length > 0) {
      const mutualQuery =
        mode === 'followers'
          ? this.supabase
              .from('follows')
              .select('following_id, created_at')
              .eq('follower_id', userId)
              .in('following_id', ids)
          : this.supabase
              .from('follows')
              .select('follower_id, created_at')
              .eq('following_id', userId)
              .in('follower_id', ids)

      const { data: mutuals, error: mutualError } = await mutualQuery
      if (mutualError) throw mutualError

      for (const mutual of (mutuals ?? []) as {
        follower_id?: string
        following_id?: string
        created_at: string
      }[]) {
        const id = mode === 'followers' ? mutual.following_id : mutual.follower_id
        if (id) mutualMap.set(id, mutual.created_at)
      }
    }

    return rows
      .map<FollowerInfo | null>((row) => {
        const id = row[idColumn]
        if (!id) return null
        const profile = profiles.get(id)
        const mutualSince = mutualMap.get(id)
        if (!profile) return null
        return {
          ...profile,
          followedAt: row.created_at,
          isMutual: Boolean(mutualSince),
          mutualSince,
        }
      })
      .filter((profile): profile is FollowerInfo => profile !== null)
  }

  private async getUserId() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser()
    return user?.id ?? null
  }

  private async getRequiredUserId() {
    const user = await this.getUserId()
    if (!user) throw new Error('User not authenticated')
    return user
  }

  private mapPersistedTitle(row: TitleRow): PersistedTitle {
    return {
      id: row.id,
      tmdb_id: row.tmdb_id,
      type: row.type,
      title: row.title,
      synopsis: row.synopsis,
      cover_image: row.cover_image,
      backdrop_image: row.backdrop_image,
      release_year: row.release_year,
      genres: row.genres || [],
      cast: row.cast || [],
      director: row.director,
      runtime: row.runtime,
      total_seasons: row.total_seasons,
      total_episodes: row.total_episodes,
      seasons_metadata: row.seasons_metadata,
    }
  }

  private mapTitleToDetails(row: TitleRow): TitleDetails {
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
      director: row.director || undefined,
      averageRating: 0,
      ratingCount: 0,
      runtime: row.runtime || undefined,
      totalSeasons: row.total_seasons || undefined,
      totalEpisodes: row.total_episodes || undefined,
    }
  }

  private mapRating(row: TitleRatingRow): UserRating {
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

  private mapEpisodeRating(row: EpisodeRatingRow): EpisodeRating {
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

  private mapWatchDiaryEntry(row: WatchDiaryRow): WatchDiaryEntry {
    return {
      id: row.id,
      userId: row.user_id,
      titleId: row.title_id,
      watchedAt: new Date(row.watched_at),
      watchType: row.watch_type,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapWatchlist(row: WatchlistRow): Watchlist {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      thumbnail: row.thumbnail || undefined,
      isShared: row.is_shared,
      shareCode: row.share_code || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }
  }

  private mapWatchlistItem(row: WatchlistItemRow): WatchlistItem {
    return {
      id: row.id,
      watchlistId: row.watchlist_id,
      titleId: row.title_id,
      addedAt: new Date(row.added_at),
      addedBy: row.added_by,
    }
  }

  private mapStats(row: RatingStatsRow): TitleRatingStats {
    return {
      averageRating: Number(row.average_rating) || 0,
      totalRatings: Number(row.total_ratings) || 0,
      starBreakdown: row.star_breakdown || {},
    }
  }

  private createShareCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }
}
