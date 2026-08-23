import type { MediaType, TMDbCast, TMDbProductionCompany, TMDbTitle } from '@kino/core'
import { TMDbService } from '@kino/core'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import {
  DiscoverAffinityCandidate,
  type DiscoverAffinityTitle,
  type DiscoverPersonAffinity,
  selectDiscoverAffinities,
} from './affinity-scoring'

import { getDiscoverMediaKey } from './media-key'
import { DiscoverAffinityCandidateGroups } from './release-affinity-candidates'

type AffinityJoinedTitle = {
  id: string
  tmdb_id: number
  type: MediaType
  cast: TMDbCast[] | null
  director: TMDbCast | null
  production_companies: TMDbProductionCompany[] | null
}

type AffinityRatingRow = {
  title_id: string
  rating: number | string | null
  watched_at: string
  title: AffinityJoinedTitle | AffinityJoinedTitle[] | null
  source: 'title' | 'episode'
}

type WatchedTitleJoin = {
  tmdb_id: number
  type: MediaType
}

type DiaryWatchedRow = {
  title: WatchedTitleJoin | WatchedTitleJoin[] | null
}

export type DiscoverAffinityData = {
  candidates: DiscoverAffinityCandidateGroups
}

function createEmptyAffinityData(): DiscoverAffinityData {
  return {
    candidates: {
      actors: [],
      directors: [],
      studios: [],
    },
  }
}

function unwrapJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function normalizeRating(value: number | string | null) {
  if (value === null) {
    return null
  }

  const rating = Number(value)

  return Number.isFinite(rating) ? rating : null
}

async function getAffinityRatingRows(userId: string): Promise<AffinityRatingRow[]> {
  const supabase = await createServerSupabaseClient()

  const [titleRatings, episodeRatings] = await Promise.all([
    supabase
      .from('title_ratings')
      .select(
        'title_id,rating,watched_at,title:titles(id,tmdb_id,type,cast,director,production_companies)'
      )
      .eq('user_id', userId)
      .not('rating', 'is', null),

    supabase
      .from('episode_ratings')
      .select(
        'title_id,rating,watched_at,title:titles(id,tmdb_id,type,cast,director,production_companies)'
      )
      .eq('user_id', userId)
      .not('rating', 'is', null),
  ])

  if (titleRatings.error) {
    throw titleRatings.error
  }

  if (episodeRatings.error) {
    throw episodeRatings.error
  }

  const titleRows = (titleRatings.data ?? []) as unknown as Omit<AffinityRatingRow, 'source'>[]

  const episodeRows = (episodeRatings.data ?? []) as unknown as Omit<AffinityRatingRow, 'source'>[]

  return [
    ...titleRows.map((row) => ({
      ...row,
      source: 'title' as const,
    })),

    ...episodeRows.map((row) => ({
      ...row,
      source: 'episode' as const,
    })),
  ]
}

function buildAffinityTitles(rows: AffinityRatingRow[]): DiscoverAffinityTitle[] {
  const byTitle = new Map<
    string,
    {
      title: AffinityJoinedTitle
      explicitRatings: Array<{
        rating: number
        watchedAt: number
      }>
      episodeRatings: number[]
    }
  >()

  for (const row of rows) {
    const title = unwrapJoined(row.title)
    const rating = normalizeRating(row.rating)

    if (!title || rating === null) {
      continue
    }

    const current = byTitle.get(row.title_id) ?? {
      title,
      explicitRatings: [],
      episodeRatings: [],
    }

    if (row.source === 'title') {
      const parsedWatchedAt = Date.parse(row.watched_at)

      current.explicitRatings.push({
        rating,
        watchedAt: Number.isFinite(parsedWatchedAt) ? parsedWatchedAt : 0,
      })
    } else {
      current.episodeRatings.push(rating)
    }

    byTitle.set(row.title_id, current)
  }

  return [...byTitle.entries()].flatMap(([titleId, entry]) => {
    const latestExplicit = [...entry.explicitRatings].sort(
      (left, right) => right.watchedAt - left.watchedAt
    )[0]

    const episodeAverage =
      entry.episodeRatings.length > 0
        ? entry.episodeRatings.reduce((total, rating) => total + rating, 0) /
          entry.episodeRatings.length
        : null

    const rating = latestExplicit?.rating ?? episodeAverage

    if (rating === null) {
      return []
    }

    return [
      {
        titleId,
        rating,
        cast: entry.title.cast,
        director: entry.title.director,
        studios: entry.title.production_companies,
      },
    ]
  })
}

async function getDiaryWatchedMediaKeys(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('watch_diary')
    .select('title:titles(tmdb_id,type)')
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  const keys = new Set<string>()

  for (const row of (data ?? []) as unknown as DiaryWatchedRow[]) {
    const title = unwrapJoined(row.title)

    if (!title) {
      continue
    }

    keys.add(getDiscoverMediaKey(title.type, title.tmdb_id))
  }

  return keys
}

function addRatedMediaKeys(keys: Set<string>, rows: AffinityRatingRow[]) {
  for (const row of rows) {
    const title = unwrapJoined(row.title)

    if (!title) {
      continue
    }

    keys.add(getDiscoverMediaKey(title.type, title.tmdb_id))
  }
}

export async function getDiscoverAffinityData(userId: string): Promise<DiscoverAffinityData> {
  const [ratingRows, diaryWatchedKeys] = await Promise.all([
    getAffinityRatingRows(userId),
    getDiaryWatchedMediaKeys(userId),
  ])

  if (ratingRows.length === 0) {
    return createEmptyAffinityData()
  }

  /*
   * Start with diary history, then also exclude every
   * rated movie/series. This covers TV episode activity
   * even if that show does not have a watch_diary row.
   */
  const watchedKeys = new Set(diaryWatchedKeys)

  addRatedMediaKeys(watchedKeys, ratingRows)

  const affinityTitles = buildAffinityTitles(ratingRows)

  const affinities = selectDiscoverAffinities(affinityTitles, 3)

  if (
    affinities.actors.length === 0 &&
    affinities.directors.length === 0 &&
    affinities.studios.length === 0
  ) {
    return {
      candidates: affinities,
    }
  }

  return {
    candidates: affinities,
  }
}
