import type { TMDbTitle, WatchedSeries } from '@kino/core'
import { applyReleasedSeriesProgress, KinoDatabaseService, TMDbService } from '@kino/core'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import {
  type DiscoverSeriesUpdateItem,
  getDiscoverSeriesUpdates,
  selectDiscoverSeriesUpdateCandidates,
} from './series-updates'

function createSeriesUpdatesTmdb(language: string) {
  const apiKey = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY

  if (!apiKey) {
    throw new Error('Missing TMDB API key.')
  }

  const tmdb = new TMDbService(apiKey)

  tmdb.setLanguage(language)

  return tmdb
}

async function refreshWatchedSeriesProgress(tmdb: TMDbService, series: WatchedSeries) {
  const details = await tmdb.getTVDetails(series.tmdb_id)

  const seasons = details.seasons.filter((season) => season.season_number > 0)

  const seasonDetails = await Promise.all(
    seasons.map((season) => tmdb.getSeasonDetails(series.tmdb_id, season.season_number))
  )

  const episodes = seasonDetails.flatMap((season) =>
    season.episodes.map((episode) => ({
      season_number: episode.season_number,
      episode_number: episode.episode_number,
      air_date: episode.air_date || null,
    }))
  )

  const refreshedSeries = applyReleasedSeriesProgress(
    {
      ...series,
      seasons_metadata: seasons,
      total_seasons: details.number_of_seasons,
      total_episodes: details.number_of_episodes,
    },
    episodes
  )

  return {
    details,
    series: refreshedSeries,
  }
}

export async function getPersonalizedSeriesUpdates(
  userId: string,
  language: string,
  limit = 12
): Promise<DiscoverSeriesUpdateItem[]> {
  const supabase = await createServerSupabaseClient()
  const database = new KinoDatabaseService(supabase)

  const watchedSeries = await database.getWatchedSeries(userId)

  if (watchedSeries.length === 0) {
    return []
  }

  const candidates = selectDiscoverSeriesUpdateCandidates(watchedSeries)

  if (candidates.length === 0) {
    return []
  }

  const tmdb = createSeriesUpdatesTmdb(language)

  const refreshResults = await Promise.allSettled(
    candidates.map((series) => refreshWatchedSeriesProgress(tmdb, series))
  )

  const refreshed = refreshResults.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  )

  if (refreshed.length === 0) {
    return []
  }

  const updates = getDiscoverSeriesUpdates(refreshed.map((item) => item.series))

  if (updates.length === 0) {
    return []
  }

  const refreshedByTmdbId = new Map(refreshed.map((item) => [item.series.tmdb_id, item]))

  return updates
    .flatMap((update) => {
      const refreshedItem = refreshedByTmdbId.get(update.tmdbId)

      if (!refreshedItem) {
        return []
      }

      const title: TMDbTitle = {
        ...refreshedItem.details,
        media_type: 'tv',
      }

      return [
        {
          update,
          title,
        },
      ]
    })
    .slice(0, limit)
}
