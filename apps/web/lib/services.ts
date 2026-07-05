'use client'

import { KinoDatabaseService, TMDbService } from '@kino/core'
import { supabase } from './supabase'

let tmdbService: TMDbService | null = null

export const db = new KinoDatabaseService(supabase)

export function getTmdb() {
  if (!tmdbService) {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
    if (!apiKey) throw new Error('Missing NEXT_PUBLIC_TMDB_API_KEY.')
    tmdbService = new TMDbService(apiKey)
  }
  return tmdbService
}
