'use client'

import { KinoDatabaseService, TMDbService } from '@kino/core'
import { supabase } from '@/lib/supabase/client'
import { createProfileQueryService } from './profile-query-service'

let tmdbService: TMDbService | null = null

export const db = createProfileQueryService(new KinoDatabaseService(supabase))

export function getTmdb() {
  if (!tmdbService) {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
    if (!apiKey) throw new Error('Missing NEXT_PUBLIC_TMDB_API_KEY.')
    tmdbService = new TMDbService(apiKey)
  }
  return tmdbService
}
