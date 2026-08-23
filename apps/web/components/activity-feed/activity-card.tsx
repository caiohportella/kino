'use client'

import { Heart } from 'lucide-react'
import Link from 'next/link'
import { Poster } from '@/components/kino'
import { RatingStars } from '@/components/media/rating-stars'
import { ReviewAuthor } from '@/components/reviews/review-author'
import { ReviewLikeButton } from '@/components/reviews/review-like-button'
import type { ActivityFeedCard } from '@/lib/activity/activity-feed'
import { formatLocalizedDate, formatLocalizedRelativeTime } from '@/lib/date'
import { useTranslation } from '@/lib/localization/i18n'
import { normalizeProfileUsername } from '@/lib/profile/profile-routes'

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

  const hasReview = Boolean(activity.review?.content?.trim())

  const profileLink = profileHref ? (
    <Link
      className="font-medium text-kino-text underline-offset-4 hover:text-kino-accent hover:underline"
      href={profileHref}
    >
      {displayName}
    </Link>
  ) : (
    <span className="font-medium text-kino-text">{displayName}</span>
  )

  /*
   * Expanded review activity
   */
  if (hasReview && activity.review) {
    return (
      <article className="relative grid grid-cols-[88px_minmax(0,1fr)] gap-5 rounded-3xl border border-white/8 bg-white/3 p-5 transition-colors hover:border-white/12 hover:bg-white/4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-7 sm:p-6">
        <Link aria-label={subjectName} className="focus-ring block self-start" href={subjectHref}>
          <Poster
            alt={subjectName}
            className="w-22 shrink-0 sm:w-32"
            src={subjectPosterUrl}
            title={subjectName}
          />
        </Link>

        <div className="flex min-w-0 flex-col">
          {/* Activity author/action */}
          <div className="flex min-w-0 items-center gap-3">
            <ReviewAuthor author={activity.actor} size="sm" />

            <p className="min-w-0 text-sm leading-6 text-kino-muted">
              {rt(sentenceKey, {
                /*
                 * The title itself is shown below in expanded cards,
                 * so avoid visually emphasizing it in the sentence.
                 */
                title: <span className="sr-only">{subjectName}</span>,
                user: profileLink,
              })}
            </p>
          </div>

          {/* Title */}
          <div className="mt-4 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              className="truncate text-xl font-semibold tracking-tight text-kino-text underline-offset-4 hover:text-kino-accent hover:underline"
              href={subjectHref}
            >
              {subjectName}
            </Link>

            {subjectYear ? (
              <span className="shrink-0 text-base text-kino-subtle">{subjectYear}</span>
            ) : null}
          </div>

          {/* Rating */}
          {activity.rating && activity.rating > 0 ? (
            <div className="mt-3">
              <RatingStars
                label={t('activity.rating')}
                readonly
                size="sm"
                value={activity.rating}
              />
            </div>
          ) : null}

          {/* Review */}
          <p className="mt-5 line-clamp-4 whitespace-pre-wrap text-base leading-7 text-kino-text sm:text-lg">
            {activity.review.content}
          </p>

          {/* Footer */}
          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
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
              ) : activity.review.likeCount > 0 ? (
                <div className="flex items-center gap-1.5 text-sm text-kino-subtle">
                  <Heart aria-hidden="true" size={15} />

                  <span>
                    {t('reviews.likeCount', {
                      count: activity.review.likeCount,
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    )
  }

  /*
   * Compact activity
   *
   * Watched, rated, added to watchlist, etc. intentionally use
   * a much shorter card because there is no review body to display.
   */
  return (
    <article className="grid min-h-23 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-white/8 bg-white/3 px-4 py-3 transition-colors hover:border-white/12 hover:bg-white/4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:gap-5 sm:px-5 sm:py-3.5">
      <Link aria-label={subjectName} className="focus-ring block" href={subjectHref}>
        <Poster
          alt={subjectName}
          className="w-14 shrink-0 sm:w-16"
          src={subjectPosterUrl}
          title={subjectName}
        />
      </Link>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-6 sm:text-base">
          {rt(sentenceKey, {
            user: profileLink,

            title: (
              <Link
                className="font-semibold text-kino-text underline-offset-4 hover:text-kino-accent hover:underline"
                href={subjectHref}
              >
                {subjectName}
              </Link>
            ),
          })}
        </div>

        {activity.rating && activity.rating > 0 ? (
          <div className="mt-1.5">
            <RatingStars label={t('activity.rating')} readonly size="xs" value={activity.rating} />
          </div>
        ) : null}
      </div>
    </article>
  )
}
