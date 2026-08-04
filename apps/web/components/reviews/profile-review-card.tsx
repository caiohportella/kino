import type { ProfileReview } from '@kino/core'
import Link from 'next/link'
import { useState } from 'react'
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
import { formatLocalizedDate } from '@/lib/date'
import { useLocale, useTranslation } from '@/lib/i18n'
import { titlePath } from '@/lib/routes'
import { getTmdb } from '@/lib/services'
import { ReviewAuthor } from './review-author'
import { ReviewEditor } from './review-editor'
import { ReviewLikeButton } from './review-like-button'
import { ReviewOwnerActions } from './review-owner-actions'

export function ProfileReviewCard({
  canLike,
  localizedTitle,
  onAuthRequired,
  onDelete,
  onLike,
  onUpdate,
  pendingLike,
  pendingOwnerAction,
  review,
}: {
  canLike: boolean
  localizedTitle?: { title: string; posterUrl: string | null; year: number | null } | null
  onAuthRequired: () => void
  onDelete: () => Promise<void>
  onLike: () => void
  onUpdate: (content: string) => Promise<boolean>
  pendingLike: boolean
  pendingOwnerAction: boolean
  review: ProfileReview
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const displayTitleName = localizedTitle?.title || review.title.name
  const displayYear = localizedTitle?.year ?? review.title.year
  const href = titlePath(review.title.tmdbId, displayTitleName, review.title.mediaType)
  const posterUrl = getTmdb().getImageUrl(
    localizedTitle?.posterUrl ?? review.title.posterUrl,
    'w300'
  )

  return (
    <article className="group relative grid h-full min-h-56 grid-cols-1 gap-4 overflow-hidden rounded-md border border-white/10 bg-white/2.5 p-4 transition-colors hover:border-kino-accent/35 hover:bg-white/4 sm:grid-cols-[76px_minmax(0,1fr)]">
      <Link
        aria-label={t('reviews.openForTitle', { title: displayTitleName })}
        className="focus-ring absolute inset-0 z-10 rounded-md"
        href={href}
        onClick={(event) => event.stopPropagation()}
      />
      <div className="pointer-events-none relative w-24 justify-self-start sm:w-auto">
        <Poster src={posterUrl} title={displayTitleName} />
      </div>
      <div className="relative min-w-0">
        <div className="pointer-events-none sm:pr-16">
          <h3 className="wrap-break-word font-semibold text-kino-text">
            {displayTitleName}
            {displayYear ? (
              <span className="font-normal text-kino-muted"> ({displayYear})</span>
            ) : null}
          </h3>
        </div>

        <div className="relative z-20 mt-3 flex items-start justify-between gap-2">
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

        <p className="pointer-events-none mt-2 text-xs text-kino-subtle">
          {formatLocalizedDate(review.createdAt, locale)}
        </p>

        <div className={editing ? 'relative z-20 mt-3' : 'pointer-events-none mt-3'}>
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

        <div className="relative z-20 mt-3 flex items-center gap-2 text-sm">
          {!review.isViewerReview ? (
            <ReviewLikeButton
              canLike={canLike}
              aria-pressed={review.likedByViewer}
              likedByViewer={review.likedByViewer}
              likeCount={review.likeCount}
              onAuthRequired={onAuthRequired}
              onLike={onLike}
              pending={pendingLike}
            />
          ) : (
            <div className="flex items-center gap-1.5 text-kino-subtle">
              <span aria-hidden="true">♥</span>
              <span>{t('reviews.likeCount', { count: review.likeCount })}</span>
            </div>
          )}
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
