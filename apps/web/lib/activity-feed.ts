'use client'

import type {
  EnrichedActivity,
  MediaType,
  ProfileReview,
  PublicUserSummary,
  UIDiaryEntry,
  UserProfile,
} from '@kino/core'
import { toReviewAuthor } from '@kino/core'
import { titlePath, watchlistPath } from '@/lib/routes'

export type ActivityFeedFilter = 'you' | 'following'

export type ActivityFeedReview = Pick<
  ProfileReview,
  'content' | 'id' | 'likeCount' | 'likedByViewer'
>

export type ActivityFeedSubject =
  | {
      readonly href: string
      readonly kind: 'title'
      readonly mediaType: MediaType
      readonly name: string
      readonly posterUrl: string | null
      readonly tmdbId: number
      readonly year: number | null
    }
  | {
      readonly href: string
      readonly kind: 'watchlist'
      readonly name: string
      readonly posterUrl: null
    }

export type ActivityFeedCard = {
  readonly actor: PublicUserSummary
  readonly id: string
  readonly rating: number | null
  readonly review: ActivityFeedReview | null
  readonly subject: ActivityFeedSubject
  readonly type: EnrichedActivity['type']
  readonly occurredAt: string
}

function createTitleSubject(title: {
  readonly mediaType: MediaType
  readonly name: string
  readonly posterUrl: string | null
  readonly tmdbId: number
  readonly year: number | null
}) {
  return {
    href: titlePath(title.tmdbId, title.name, title.mediaType),
    kind: 'title' as const,
    mediaType: title.mediaType,
    name: title.name,
    posterUrl: title.posterUrl,
    tmdbId: title.tmdbId,
    year: title.year,
  }
}

function createWatchlistSubject(watchlistId: string, watchlistName: string | null) {
  const name = watchlistName?.trim() || watchlistId
  return {
    href: watchlistPath(watchlistId, name),
    kind: 'watchlist' as const,
    name,
    posterUrl: null,
  }
}

export function buildDiaryActivityFeedItems(
  profile: Pick<UserProfile, 'avatar_url' | 'display_name' | 'id' | 'username'>,
  diaryEntries: readonly UIDiaryEntry[],
  reviews: readonly ProfileReview[]
) {
  const actor = toReviewAuthor(profile)
  const reviewByTitleId = new Map(reviews.map((review) => [review.titleId, review] as const))

  return diaryEntries
    .map<ActivityFeedCard>((entry) => {
      const review = reviewByTitleId.get(entry.titleId) ?? null
      return {
        actor,
        id: entry.id,
        occurredAt: entry.watchedAt,
        rating: entry.rating ?? null,
        review: review
          ? {
              content: review.content,
              id: review.id,
              likeCount: review.likeCount,
              likedByViewer: review.likedByViewer,
            }
          : null,
        subject: createTitleSubject({
          mediaType: entry.type,
          name: entry.titleName,
          posterUrl: entry.coverImage,
          tmdbId: entry.tmdbId,
          year: entry.releaseYear,
        }),
        type: 'watch',
      }
    })
    .sort(compareActivityFeedCards)
}

export function buildFollowingActivityFeedItems(items: readonly EnrichedActivity[]) {
  const reviewByActivityKey = new Map<string, Extract<EnrichedActivity, { type: 'review' }>>()
  const watchedActivityKeys = new Set<string>()

  for (const item of items) {
    if (item.type === 'review') {
      reviewByActivityKey.set(createActivityKey(item.actor.id, item.title.id), item)
    } else if (item.type === 'watch') {
      watchedActivityKeys.add(createActivityKey(item.actor.id, item.title.id))
    }
  }

  return items
    .flatMap<ActivityFeedCard | null>((item) => {
      switch (item.type) {
        case 'watch': {
          const review = reviewByActivityKey.get(createActivityKey(item.actor.id, item.title.id))
          return {
            actor: item.actor,
            id: item.id,
            occurredAt: item.watchedAt,
            rating: item.rating,
            review: review
              ? {
                  content: review.review.content,
                  id: review.review.id,
                  likeCount: review.review.likeCount,
                  likedByViewer: review.review.likedByViewer,
                }
              : null,
            subject: createTitleSubject({
              mediaType: item.title.mediaType,
              name: item.title.name,
              posterUrl: item.title.posterUrl,
              tmdbId: item.title.id,
              year: item.title.year,
            }),
            type: item.type,
          }
        }
        case 'review': {
          if (watchedActivityKeys.has(createActivityKey(item.actor.id, item.title.id))) return null

          return {
            actor: item.actor,
            id: item.id,
            occurredAt: item.createdAt,
            rating: item.rating,
            review: {
              content: item.review.content,
              id: item.review.id,
              likeCount: item.review.likeCount,
              likedByViewer: item.review.likedByViewer,
            },
            subject: createTitleSubject({
              mediaType: item.title.mediaType,
              name: item.title.name,
              posterUrl: item.title.posterUrl,
              tmdbId: item.title.id,
              year: item.title.year,
            }),
            type: item.type,
          }
        }
        case 'rating':
          return {
            actor: item.actor,
            id: item.id,
            occurredAt: item.createdAt,
            rating: item.rating,
            review: null,
            subject: createTitleSubject({
              mediaType: item.title.mediaType,
              name: item.title.name,
              posterUrl: item.title.posterUrl,
              tmdbId: item.title.id,
              year: item.title.year,
            }),
            type: item.type,
          }
        case 'watchlist_create':
          return {
            actor: item.actor,
            id: item.id,
            occurredAt: item.createdAt,
            rating: null,
            review: null,
            subject: createWatchlistSubject(item.id, item.watchlistName),
            type: item.type,
          }
        case 'watchlist_add':
          return {
            actor: item.actor,
            id: item.id,
            occurredAt: item.createdAt,
            rating: null,
            review: null,
            subject: createTitleSubject({
              mediaType: item.title.mediaType,
              name: item.title.name,
              posterUrl: item.title.posterUrl,
              tmdbId: item.title.id,
              year: item.title.year,
            }),
            type: item.type,
          }
      }
    })
    .filter((item): item is ActivityFeedCard => Boolean(item))
    .sort(compareActivityFeedCards)
}

export function updateActivityFeedReviewLike(
  items: readonly ActivityFeedCard[] | undefined,
  reviewId: string,
  liked: boolean
) {
  if (!items) return items
  return items.map((item) => {
    if (item.review?.id !== reviewId) return item
    return {
      ...item,
      review: {
        ...item.review,
        likedByViewer: liked,
        likeCount: Math.max(0, item.review.likeCount + (liked ? 1 : -1)),
      },
    }
  })
}

function compareActivityFeedCards(left: ActivityFeedCard, right: ActivityFeedCard) {
  const activityDelta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  if (activityDelta !== 0) return activityDelta
  return right.id.localeCompare(left.id)
}

function createActivityKey(actorId: string, tmdbId: number) {
  return `${actorId}:${tmdbId}`
}
