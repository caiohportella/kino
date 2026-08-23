'use client'

import { PencilLine } from 'lucide-react'
import Link from 'next/link'
import { Poster } from '@/components/kino'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatLocalizedRelativeTime } from '@/lib/date'
import type { DiscoverFriendActivity } from '@/lib/discover/friends-activity'
import { useTranslation } from '@/lib/localization/i18n'

type FriendTitleActivity = DiscoverFriendActivity['activities'][number]

const MAX_VISIBLE_FRIENDS = 3

export function DiscoverFriendActivityCard({
  item,
  posterUrl,
  title,
}: {
  item: DiscoverFriendActivity
  posterUrl: string | null
  title: string
}) {
  const activity = item.latestActivity

  return (
    <article className="w-39 shrink-0 sm:w-40">
      <Link className="group min-w-0 focus-ring" href={activity.subject.href}>
        <Poster
          artworkOverlay={<FriendActivityOverlay item={item} title={title} />}
          className="w-full rounded-md"
          showHoverPresentation={false}
          sizes="156px"
          src={posterUrl}
          title={title}
        />
      </Link>
    </article>
  )
}

function FriendActivityOverlay({ item, title }: { item: DiscoverFriendActivity; title: string }) {
  console.log(
    '[discover-friends-debug]',
    item.activities.map((activity) => ({
      actor: activity.actor.username,
      activityId: activity.id,
      type: activity.type,
      activityKind: activity.activityKind,
      rating: activity.rating,
      reviewId: activity.review?.id ?? null,
      review: activity.review?.content ?? null,
      tmdbId: activity.subject.kind === 'title' ? activity.subject.tmdbId : null,
    }))
  )
  const activities = getVisibleFriendActivities(item)

  const primaryActivity = activities[0]

  const additionalActivities = activities.slice(1)

  const totalFriends = countDistinctActors(item.activities)

  const additionalFriendCount = Math.max(0, totalFriends - 1)

  const remainingFriends = Math.max(0, totalFriends - activities.length)

  if (!primaryActivity) {
    return null
  }

  return (
    <div
      className="
        pointer-events-none
        absolute inset-x-0 bottom-0 z-20
        bg-linear-to-t from-black/95 via-black/75 to-transparent
        px-3 pb-3 pt-12
      "
    >
      <div className="mb-2 min-w-0">
        <div
          className="
            mb-1.5 h-0.5 w-8
            origin-left scale-x-0
            rounded-full bg-kino-accent
            transition-transform duration-300 ease-out

            group-hover:scale-x-100
            group-focus-within:scale-x-100

            motion-reduce:scale-x-100
            motion-reduce:transition-none
          "
        />

        <div
          className="
            truncate
            text-sm font-semibold leading-5
            text-white
            transition-transform duration-300 ease-out

            group-hover:-translate-y-0.5
            group-focus-within:-translate-y-0.5

            motion-reduce:transform-none
            motion-reduce:transition-none
          "
        >
          {title}
        </div>
      </div>

      <FriendActivityLine
        activity={primaryActivity}
        additionalCount={additionalFriendCount}
        remainingCount={remainingFriends}
      />

      {additionalActivities.length > 0 || remainingFriends > 0 ? (
        <div
          className="
            grid grid-rows-[0fr]
            opacity-0
            transition-[grid-template-rows,opacity,margin] duration-300 ease-out

            group-hover:mt-2
            group-hover:grid-rows-[1fr]
            group-hover:opacity-100

            group-focus-within:mt-2
            group-focus-within:grid-rows-[1fr]
            group-focus-within:opacity-100

            motion-reduce:transition-none
          "
        >
          <div className="min-h-0 overflow-hidden">
            <div className="grid gap-2 border-t border-white/10 pt-2">
              {additionalActivities.map((activity) => (
                <FriendActivityLine activity={activity} expanded key={activity.actor.id} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FriendActivityLine({
  activity,
  additionalCount = 0,
  remainingCount = 0,
  expanded = false,
}: {
  activity: FriendTitleActivity
  additionalCount?: number
  remainingCount?: number
  expanded?: boolean
}) {
  const { t } = useTranslation()

  const actor = activity.actor

  const actorName =
    actor.displayName ||
    actor.username ||
    t('common.user', {
      defaultValue: 'User',
    })

  const relativeTime = formatLocalizedRelativeTime(activity.occurredAt, t)

  const hasReview =
    activity.activityKind === 'watched_and_reviewed' ||
    activity.activityKind === 'rated_and_reviewed' ||
    activity.type === 'review'

  return (
    <div className="flex min-w-0 items-start gap-2">
      <Avatar aria-hidden="true" className="size-6 shrink-0" size="sm">
        <AvatarImage alt="" src={actor.avatarUrl || undefined} />

        <AvatarFallback className="bg-kino-surface text-[9px] text-kino-text">
          {actorName.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <span className="min-w-0 truncate text-[0.7rem] font-semibold text-white/90">
              {actorName}
            </span>

            {hasReview ? (
              <PencilLine
                aria-hidden="true"
                className="size-2.5 shrink-0 text-kino-accent"
                strokeWidth={2.25}
              />
            ) : null}
          </span>

          {additionalCount > 0 ? (
            <span className="relative shrink-0">
              <span
                className="
                  inline-flex rounded-full
                  bg-white/10
                  px-1.5 py-0.5
                  text-[0.58rem] font-semibold
                  text-white/65
                  transition-opacity duration-200

                  group-hover:opacity-0
                  group-focus-within:opacity-0
                "
              >
                +{additionalCount}
              </span>

              {remainingCount > 0 ? (
                <span
                  className="
                    pointer-events-none absolute inset-0
                    inline-flex items-center justify-center
                    rounded-full
                    bg-white/10
                    px-1.5 py-0.5
                    text-[0.58rem] font-semibold
                    text-white/65
                    opacity-0
                    transition-opacity duration-200

                    group-hover:opacity-100
                    group-focus-within:opacity-100
                  "
                >
                  +{remainingCount}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
          <FriendActivitySummary activity={activity} />

          <span className="shrink-0 text-[0.6rem] font-medium text-white/45">{relativeTime}</span>
        </div>
      </div>
    </div>
  )
}

function FriendActivitySummary({ activity }: { activity: FriendTitleActivity }) {
  const { t } = useTranslation()

  if (activity.rating != null) {
    return (
      <span
        aria-label={t('discover.friends.rating', {
          defaultValue: '{{rating}} out of 5 stars',
          rating: activity.rating,
        })}
        className="shrink-0 whitespace-nowrap text-[0.68rem] font-semibold tracking-[0.04em] text-kino-accent"
      >
        {formatStars(activity.rating)}
      </span>
    )
  }

  switch (activity.type) {
    case 'watch':
      return (
        <span className="shrink-0 whitespace-nowrap text-[0.65rem] font-medium text-white/55">
          {t('discover.friends.watched', {
            defaultValue: 'Watched',
          })}
        </span>
      )

    case 'review':
      return (
        <span className="shrink-0 whitespace-nowrap text-[0.65rem] font-medium text-white/55">
          {t('discover.friends.reviewed', {
            defaultValue: 'Reviewed',
          })}
        </span>
      )

    case 'rating':
      return (
        <span className="shrink-0 whitespace-nowrap text-[0.65rem] font-medium text-white/55">
          {t('discover.friends.rated', {
            defaultValue: 'Rated',
          })}
        </span>
      )

    default:
      return null
  }
}

function getRepresentativeFriendActivities(item: DiscoverFriendActivity) {
  const byActor = new Map<string, FriendTitleActivity>()

  for (const activity of item.activities) {
    const existing = byActor.get(activity.actor.id)

    if (!existing) {
      byActor.set(activity.actor.id, activity)
      continue
    }

    /*
     * A rating carries more useful information than a plain watch,
     * so preserve it as the representative activity for this friend.
     */
    if (existing.rating == null && activity.rating != null) {
      byActor.set(activity.actor.id, activity)
    }
  }

  const primaryActorId = item.latestActivity.actor.id

  const primary = byActor.get(primaryActorId) ?? item.latestActivity

  const others = [...byActor.values()].filter((activity) => activity.actor.id !== primaryActorId)

  return [primary, ...others]
}

function getVisibleFriendActivities(item: DiscoverFriendActivity) {
  return getRepresentativeFriendActivities(item).slice(0, MAX_VISIBLE_FRIENDS)
}

function countDistinctActors(activities: readonly FriendTitleActivity[]) {
  return new Set(activities.map((activity) => activity.actor.id)).size
}

function formatStars(rating: number) {
  const clampedRating = Math.max(0, Math.min(5, rating))

  const fullStars = Math.floor(clampedRating)

  const hasHalfStar = clampedRating - fullStars >= 0.5

  return `${'★'.repeat(fullStars)}${hasHalfStar ? '½' : ''}`
}
