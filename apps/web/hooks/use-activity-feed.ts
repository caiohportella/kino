'use client'

import type { Activity, ProfileReview } from '@kino/core'
import { activityQueryKeys, enrichActivityPage } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  buildDiaryActivityFeedItems,
  buildFollowingActivityFeedItems,
  type ActivityFeedCard,
  type ActivityFeedFilter,
} from '@/lib/activity-feed'
import { db } from '@/lib/services'

export function useActivityFeed(
  viewerId: string | null,
  filter: ActivityFeedFilter,
  locale: string,
  region: string,
  enabled = true
) {
  const query = useQuery({
    queryKey: activityQueryKeys.feed({
      includeOwnActivity: filter === 'you',
      locale,
      region,
      pageSize: 1_000,
      viewerId: viewerId ?? 'anonymous',
    }),
    queryFn: async () => {
      if (!viewerId) return [] as ActivityFeedCard[]
      if (filter === 'you') {
        const profile = await db.getUserProfile(viewerId)
        if (!profile) return [] as ActivityFeedCard[]
        const [diaryEntries, reviews] = await Promise.all([
          db.getDiaryEntries(viewerId),
          profile?.username
            ? db.getProfileReviews(profile.username, { limit: 1_000 })
            : Promise.resolve({ items: [] as ProfileReview[] }),
        ])
        return buildDiaryActivityFeedItems(
          profile,
          diaryEntries,
          reviews.items as ProfileReview[]
        )
      }

      const activityItems: Activity[] = []
      let cursor: Parameters<typeof db.getActivityFeed>[0]['cursor'] | undefined

      for (;;) {
        const page = await db.getActivityFeed({
          includeOwnActivity: false,
          locale,
          pageSize: 1_000,
          region,
          viewerId,
          cursor,
        })
        activityItems.push(...page.items)
        if (!page.nextCursor) break
        cursor = page.nextCursor
      }

      if (activityItems.length === 0) return [] as ActivityFeedCard[]

      const actorIds = [...new Set(activityItems.map((item) => item.actorId))]
      const profiles = await db.getUserProfilesByIds(actorIds)
      const profileMap = Object.fromEntries(profiles.map((profile) => [profile.id, profile] as const))
      return buildFollowingActivityFeedItems(enrichActivityPage(activityItems, profileMap))
    },
    enabled: enabled && Boolean(viewerId),
    staleTime: 60_000,
  })

  const items = useMemo(() => query.data ?? [], [query.data])

  return {
    error: query.error,
    isError: query.isError,
    isLoading: query.isPending,
    items,
  }
}
