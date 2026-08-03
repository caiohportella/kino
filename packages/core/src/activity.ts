import type { UserProfile } from './types.ts'

export type ActivityVisibility = 'public'

export type ActivityCursor = {
  readonly createdAt: string
  readonly activityId: string
}

export type ActivityFeedInput = {
  readonly viewerId: string
  readonly includeOwnActivity: boolean
  readonly locale: string
  readonly region: string
  readonly cursor?: ActivityCursor
  readonly pageSize?: number
  readonly schemaVersion?: string
}

export type ActivityBase = {
  readonly id: string
  readonly actorId: string
  readonly createdAt: string
  readonly visibility: ActivityVisibility
}

export type ActivityTitle = {
  readonly id: number
  readonly mediaType: 'movie' | 'tv'
  readonly name: string
  readonly slug: string
  readonly year: number | null
  readonly posterUrl: string | null
}

export type RatingActivity = ActivityBase & {
  readonly type: 'rating'
  readonly title: ActivityTitle
  readonly rating: number
}

export type ReviewActivity = ActivityBase & {
  readonly type: 'review'
  readonly title: ActivityTitle
  readonly rating: number | null
  readonly review: {
    readonly id: string
    readonly content: string
    readonly likeCount: number
    readonly likedByViewer: boolean
  }
}

export type WatchActivity = ActivityBase & {
  readonly type: 'watch'
  readonly title: ActivityTitle
  readonly watchedAt: string
  readonly isRewatch: boolean
  readonly rating: number | null
}

export type WatchlistAddActivity = ActivityBase & {
  readonly type: 'watchlist_add'
  readonly title: ActivityTitle
}

export type WatchlistCreateActivity = ActivityBase & {
  readonly type: 'watchlist_create'
  readonly watchlistName: string | null
}

export type Activity =
  | RatingActivity
  | ReviewActivity
  | WatchActivity
  | WatchlistAddActivity
  | WatchlistCreateActivity

export type ActivityFeedScope = {
  readonly includeOwnActivity: boolean
}

export type ActivityFeedPage = {
  readonly items: readonly Activity[]
  readonly nextCursor: ActivityCursor | null
}

export function createActivityCursor(activity: Activity): ActivityCursor {
  return {
    createdAt: activity.createdAt,
    activityId: activity.id,
  }
}

export function normalizeActivityFeedItems(items: readonly Activity[]): Activity[] {
  return [...items].sort((left, right) => {
    const createdAtDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt)
    if (createdAtDelta !== 0) return createdAtDelta
    return right.id.localeCompare(left.id)
  })
}

export function compareActivityCursor(cursor: ActivityCursor, item: Activity): number {
  const cursorTime = Date.parse(cursor.createdAt)
  const itemTime = Date.parse(item.createdAt)
  if (itemTime !== cursorTime) return itemTime - cursorTime
  return item.id.localeCompare(cursor.activityId)
}

/**
 * Stable, domain-identity key for an activity item.
 *
 * Uses the union of `type` + `id` so the same logical activity never
 * collides across different activity tables, even if two tables happen to
 * share a UUID (which they don't in practice, but this guard is cheap).
 *
 * Includes title identity where present so the same underlying row rendered
 * in different feed contexts still gets a unique React key.
 */
export function getActivityKey(activity: Activity): string {
  const parts = [activity.type, activity.id]
  if (
    activity.type === 'rating' ||
    activity.type === 'review' ||
    activity.type === 'watch' ||
    activity.type === 'watchlist_add'
  ) {
    parts.push(String(activity.title.id), activity.title.mediaType)
  }
  return parts.join(':')
}

export type ActivityActor = {
  readonly id: string
  readonly username: string | null
  readonly displayName: string | null
  readonly avatarUrl: string | null
}

export function toActivityActor(
  profile: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>
): ActivityActor {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  }
}

export function getDisplayName(actor: ActivityActor): string {
  return actor.displayName?.trim() || actor.username || 'Kino user'
}

export type EnrichedActivity = Activity & {
  readonly actor: ActivityActor
}

export function slugifyActivityTitle(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Enriches activity items with actor profile data resolved from a
 * pre-fetched profile map.  Activities whose actor is missing from the
 * map are skipped (they cannot be rendered without an author).
 */
export function enrichActivityPage(
  items: readonly Activity[],
  profiles: Record<string, UserProfile>
): EnrichedActivity[] {
  const result: EnrichedActivity[] = []
  for (const activity of items) {
    const profile = profiles[activity.actorId]
    if (!profile) continue
    result.push({ ...activity, actor: toActivityActor(profile) })
  }
  return result
}

/**
 * Deduplicates activity items by their stable key, preserving the first
 * occurrence (which is already sorted newest-first by `normalizeActivityFeedItems`).
 */
export function deduplicateActivities(items: readonly EnrichedActivity[]): EnrichedActivity[] {
  const seen = new Set<string>()
  const result: EnrichedActivity[] = []
  for (const item of items) {
    const key = getActivityKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}
