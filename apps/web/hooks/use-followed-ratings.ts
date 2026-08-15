'use client'

import type { FollowedRating } from '@kino/core'
import { ratingKeys } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/services'

export function useFollowedTitleRatings(titleId: string, enabled = true) {
  return useQuery({
    queryKey: ratingKeys.followedTitle(titleId),
    queryFn: () => db.getFollowedTitleRatings(titleId),
    enabled: enabled && Boolean(titleId),
    staleTime: 60_000,
  })
}

export function useFollowedEpisodeRatings(titleId: string, seasonNumber: number, enabled = true) {
  return useQuery({
    queryKey: ratingKeys.followedEpisodes(titleId, seasonNumber),
    queryFn: async () => {
      const response = await db.getFollowedEpisodeRatings(titleId, seasonNumber)
      const episodes = Object.fromEntries(
        Object.entries(response.episodes).map(([key, items]) => [
          key,
          items
            .map((item) => normalizeEpisodeRating(item))
            .filter((item): item is FollowedRating => item !== null),
        ])
      )
      return { ...response, episodes }
    },
    enabled: enabled && Boolean(titleId) && seasonNumber > 0,
    staleTime: 60_000,
  })
}

function normalizeEpisodeRating(item: FollowedRating | Record<string, unknown>) {
  if ('user' in item && item.user && typeof item.user === 'object') {
    const user = item.user as { id?: unknown }
    const rating = Number((item as FollowedRating).rating)
    return typeof user.id === 'string' && user.id && rating > 0 && Number.isFinite(rating)
      ? { ...(item as FollowedRating), rating }
      : null
  }

  const raw = item as Record<string, unknown>
  const userId = raw.userId
  const rating = Number(raw.rating)
  if (typeof userId !== 'string' || !userId || !Number.isFinite(rating) || rating <= 0) return null

  return {
    user: {
      id: userId,
      username: typeof raw.username === 'string' ? raw.username : null,
      displayName: typeof raw.displayName === 'string' ? raw.displayName : null,
      avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : null,
    },
    rating,
    watchedAt: typeof raw.watchedAt === 'string' ? raw.watchedAt : '',
  } satisfies FollowedRating
}
