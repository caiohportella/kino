import type { ProfileReview } from '@kino/core'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Poster } from '@/components/kino'
import { RatingStars } from '@/components/rating-stars'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTranslation } from '@/lib/i18n'
import { resolveLocalizedTitlePresentation } from '@/lib/localized-title-presentation'
import { titlePath } from '@/lib/routes'
import { getTmdb } from '@/lib/services'
import { useLocalizedTitles } from '@/lib/use-localized-titles'
import { cn } from '@/lib/utils'
import { ProfileReviewSkeleton } from './profile-review-skeleton'
import { ReviewAuthor } from './review-author'
import { ReviewEditor } from './review-editor'
import { ReviewOwnerActions } from './review-owner-actions'

export function ProfileReviewCard({
  canLike,
  onAuthRequired,
  onDelete,
  onLike,
  onUpdate,
  pendingLike,
  pendingOwnerAction,
  review,
}: {
  canLike: boolean
  onAuthRequired: () => void
  onDelete: () => Promise<void>
  onLike: () => void
  onUpdate: (content: string) => Promise<boolean>
  pendingLike: boolean
  pendingOwnerAction: boolean
  review: ProfileReview
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const localizedRequest = useMemo(
    () => ({ tmdbId: review.title.tmdbId, type: review.title.mediaType }),
    [review.title.mediaType, review.title.tmdbId]
  )
  const localizedTitles = useLocalizedTitles([localizedRequest])
  const localizedTitle = resolveLocalizedTitlePresentation({
    data: localizedTitles.data,
    errors: localizedTitles.errors,
    isError: localizedTitles.isError,
    missing: localizedTitles.missing,
    request: localizedRequest,
    unknownTitle: t('reviews.titleUnavailable'),
  })

  if (localizedTitles.isPending) {
    return (
      <div aria-busy="true">
        <ProfileReviewSkeleton />
      </div>
    )
  }

  const displayTitle =
    localizedTitle.status === 'ready' ? localizedTitle.title : t('reviews.titleUnavailable')
  const href = titlePath(review.title.tmdbId, displayTitle, review.title.mediaType)
  const posterUrl = getTmdb().getImageUrl(
    localizedTitle.posterPath || review.title.posterUrl,
    'w300'
  )

  return (
    <article className="group relative grid h-full min-h-56 grid-cols-[76px_minmax(0,1fr)] gap-4 overflow-hidden rounded-md border border-white/10 bg-white/2.5 p-4 transition-colors hover:border-kino-accent/35 hover:bg-white/4">
      <Link
        aria-label={t('reviews.openForTitle', { title: displayTitle })}
        className="focus-ring absolute inset-0 rounded-md"
        href={href}
      />
      <div className="pointer-events-none relative">
        <Poster src={posterUrl} title={displayTitle} />
      </div>
      <div className="relative min-w-0">
        {/* Title gets its own bottom margin (mb-4) instead of relying on the
            reviewer row's top margin — makes it read as a distinct block */}
        <div className="pointer-events-none mb-4 pr-16">
          <h3 className="wrap-break-word font-semibold text-kino-text">
            {displayTitle}
            {localizedTitle.year ? (
              <span className="font-normal text-kino-muted"> ({localizedTitle.year})</span>
            ) : null}
          </h3>
        </div>

        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <ReviewAuthor author={review.author} size="sm" />
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-kino-muted">
              <span>
                {t('reviews.reviewedBy')} <ReviewAuthor author={review.author} variant="name" />
              </span>
              {review.rating ? (
                <RatingStars
                  label={t('reviews.ratingLabel')}
                  readonly
                  size="xs"
                  value={review.rating}
                />
              ) : null}
            </div>
          </div>
          {review.isViewerReview ? (
            <ReviewOwnerActions
              disabled={pendingOwnerAction}
              onDelete={() => setConfirmDelete(true)}
              onEdit={() => setEditing(true)}
            />
          ) : null}
        </div>

        {/* Date is metadata about the reviewer row directly above it, so it
            stays close (mt-0.5) rather than at the same distance as the title gap */}
        <p className="mt-0.5 text-xs text-kino-subtle">
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
            new Date(review.createdAt)
          )}
        </p>

        {/* Body gets a clearly larger gap (mt-4) than the date's, marking it
            as the next section rather than another metadata line */}
        <div className="relative z-10 mt-4">
          {editing ? (
            <ReviewEditor
              initialContent={review.content}
              onCancel={() => setEditing(false)}
              onSave={async (content) => {
                const saved = await onUpdate(content)
                if (saved) setEditing(false)
                return saved
              }}
              pending={pendingOwnerAction}
            />
          ) : (
            <p className="line-clamp-5 wrap-break-word whitespace-pre-wrap text-sm leading-6 text-kino-text md:line-clamp-4">
              {review.content}
            </p>
          )}
        </div>

        {/* Footer separated with a hairline + its own top padding, so likes
            read as an action zone rather than a trailing line of the review */}
        <div className="relative z-10 mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-sm">
          {!review.isViewerReview ? (
            <button
              aria-pressed={review.likedByViewer}
              className={cn(
                'focus-ring inline-flex items-center gap-1.5 rounded-md px-1 py-1 font-medium transition-colors',
                review.likedByViewer ? 'text-kino-accent' : 'text-kino-muted hover:text-kino-text'
              )}
              disabled={pendingLike}
              onClick={(event) => {
                event.stopPropagation()
                canLike ? onLike() : onAuthRequired()
              }}
              type="button"
            >
              <Heart
                aria-hidden="true"
                fill={review.likedByViewer ? 'currentColor' : 'none'}
                size={16}
              />
              {t(review.likedByViewer ? 'reviews.unlike' : 'reviews.like')}
            </button>
          ) : (
            <Heart aria-hidden="true" className="text-kino-muted" size={16} />
          )}
          <span className="text-kino-subtle">
            {t('reviews.likeCount', { count: review.likeCount })}
          </span>
        </div>
      </div>

      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reviews.delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('reviews.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingOwnerAction}
              onClick={() => void onDelete()}
              variant="destructive"
            >
              {t('reviews.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}
