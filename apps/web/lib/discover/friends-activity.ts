import type { ActivityFeedCard } from '@/lib/activity/activity-feed'

type TitleActivity = ActivityFeedCard & {
  subject: Extract<ActivityFeedCard['subject'], { kind: 'title' }>
}

export type DiscoverFriendActivity = {
  identity: string
  latestActivity: TitleActivity
  activities: TitleActivity[]
  actors: ActivityFeedCard['actor'][]
}

export function buildDiscoverFriendsActivity(
  items: readonly ActivityFeedCard[],
  limit = 12
): DiscoverFriendActivity[] {
  const titleActivities = items.filter(
    (item): item is TitleActivity => item.subject.kind === 'title' && item.type !== 'watchlist_add'
  )

  const groups = new Map<string, DiscoverFriendActivity>()

  for (const activity of titleActivities) {
    const identity = [activity.subject.mediaType, activity.subject.tmdbId].join(':')

    const existing = groups.get(identity)

    if (!existing) {
      groups.set(identity, {
        identity,
        latestActivity: activity,
        activities: [activity],
        actors: [activity.actor],
      })

      continue
    }

    existing.activities.push(activity)

    if (!existing.actors.some((actor) => actor.id === activity.actor.id)) {
      existing.actors.push(activity.actor)
    }
  }

  return [...groups.values()].slice(0, limit)
}
