'use client'

import { KinoDatabaseService, TMDbService } from '@kino/core'
import { supabase } from '@/lib/supabase/client'
import { createProfileQueryService } from './profile-query-service'

let tmdbService: TMDbService | null = null

export const db = createProfileQueryService(new KinoDatabaseService(supabase), {
  getEpisodeAvailability: async (series) => {
    const tmdb = getTmdb()
    const seasons = series.seasons_metadata || []
    if (seasons.length === 0) throw new Error('No season metadata available.')
    const seasonResults = await Promise.all(
      seasons
        .filter((season) => season.season_number > 0)
        .map(async (season) => {
          const details = await tmdb.getSeasonDetails(series.tmdb_id, season.season_number)
          return details.episodes.map((episode) => ({
            season_number: season.season_number,
            episode_number: episode.episode_number,
            air_date: episode.air_date || null,
          }))
        })
    )
    return seasonResults.flat()
  },
})

export function getTmdb() {
  if (!tmdbService) {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
    if (!apiKey) throw new Error('Missing NEXT_PUBLIC_TMDB_API_KEY.')
    tmdbService = new TMDbService(apiKey)
  }
  return tmdbService
}
