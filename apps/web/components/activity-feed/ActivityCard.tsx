'use client'

import { Heart } from 'lucide-react'
import Link from 'next/link'
import { Poster } from '@/components/kino'
import { RatingStars } from '@/components/rating-stars'
import { ReviewAuthor } from '@/components/reviews/review-author'
import { ReviewLikeButton } from '@/components/reviews/review-like-button'
import type { ActivityFeedCard } from '@/lib/activity-feed'
import { formatLocalizedDate } from '@/lib/date'
import { useTranslation } from '@/lib/i18n'
import { normalizeProfileUsername } from '@/lib/profile-routes'

export function ActivityCard({
  activity,
  canLikeReview,
  locale,
  localizedTitle,
  onAuthRequired,
  onLikeReview,
  pendingLike,
}: {
  activity: ActivityFeedCard
  canLikeReview: boolean
  locale: string
  localizedTitle?: {
    title: string
    posterUrl: string | null
    year: number | null
  } | null
  onAuthRequired: () => void
  onLikeReview: () => void
  pendingLike: boolean
}) {
  const { t, rt } = useTranslation()
  const displayName =
    activity.actor.displayName?.trim() || activity.actor.username || t('reviews.user')
  const normalizedUsername = activity.actor.username
    ? normalizeProfileUsername(activity.actor.username)
    : null
  const profileHref = normalizedUsername ? `/${encodeURIComponent(normalizedUsername)}` : null
  const subjectHref = activity.subject.href
  const subjectName = localizedTitle?.title || activity.subject.name
  const subjectPosterUrl =
    activity.subject.kind === 'title'
      ? (localizedTitle?.posterUrl ?? activity.subject.posterUrl)
      : null
  const subjectYear =
    activity.subject.kind === 'title' ? (localizedTitle?.year ?? activity.subject.year) : null
  const activityTypeKeys: Partial<Record<typeof activity.type, string>> = {
    watchlist_create: 'activity.createdWatchlist',
    watchlist_add: 'activity.addToWatchlist',
  }

  const activityKindKeys: Partial<Record<NonNullable<typeof activity.activityKind>, string>> = {
    watched_and_reviewed: 'activity.watchedReviewed',
    watched_and_rated: 'activity.watchedAndRated',
    rated_and_reviewed: 'activity.ratedAndReviewed',
    rated: 'activity.rated',
    reviewed: 'activity.reviewedTitle',
  }

  const sentenceKey =
    activityTypeKeys[activity.type] ??
    (activity.activityKind ? activityKindKeys[activity.activityKind] : undefined) ??
    (activity.review ? 'activity.watchedReviewed' : 'activity.watched')

  return (
    <article className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 rounded-md border border-white/10 bg-white/3 p-4 transition-colors hover:border-white/15 hover:bg-white/4.5 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-5 sm:p-5">
      <Link aria-label={subjectName} className="focus-ring block self-start" href={subjectHref}>
        <Poster
          alt={subjectName}
          className="w-20 shrink-0 sm:w-24"
          src={subjectPosterUrl}
          title={subjectName}
        />
      </Link>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ReviewAuthor author={activity.actor} size="sm" />

            <p className="min-w-0 text-sm leading-6 text-kino-muted">
              {rt(sentenceKey, {
                title: (
                  <Link
                    className="font-semibold text-kino-text underline-offset-4 hover:text-kino-accent hover:underline"
                    href={subjectHref}
                  >
                    {subjectName}
                  </Link>
                ),

                user: profileHref ? (
                  <Link
                    className="font-semibold text-kino-text underline-offset-4 hover:text-kino-accent hover:underline"
                    href={profileHref}
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span className="font-semibold text-kino-text">{displayName}</span>
                ),
              })}
            </p>
          </div>
        </div>

        <div className="mt-3 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              className="text-lg font-semibold text-kino-text underline-offset-4 hover:text-kino-accent hover:underline"
              href={subjectHref}
            >
              {subjectName}
            </Link>
            {subjectYear ? <span className="text-sm text-kino-muted">{subjectYear}</span> : null}
          </div>

          {activity.rating && activity.rating > 0 ? (
            <div className="mt-2">
              <RatingStars
                label={t('activity.rating')}
                readonly
                size="xs"
                value={activity.rating}
              />
            </div>
          ) : null}

          {activity.review ? (
            <div className="mt-3 grid gap-3">
              <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-kino-text">
                {activity.review.content}
              </p>
              <div>
                {canLikeReview ? (
                  <ReviewLikeButton
                    canLike={canLikeReview}
                    likedByViewer={activity.review.likedByViewer}
                    likeCount={activity.review.likeCount}
                    onAuthRequired={onAuthRequired}
                    onLike={onLikeReview}
                    pending={pendingLike}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 text-sm text-kino-subtle">
                    <Heart aria-hidden="true" size={16} />
                    <span>
                      {t('reviews.likeCount', {
                        count: activity.review.likeCount,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
