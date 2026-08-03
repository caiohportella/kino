import type { Review } from '@kino/core'
import { useState } from 'react'
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
import { ReviewAuthor } from './review-author'
import { ReviewEditor } from './review-editor'
import { ReviewLikeButton } from './review-like-button'
import { ReviewOwnerActions } from './review-owner-actions'

export function ReviewCard({
  review,
  canLike,
  pendingLike,
  pendingOwnerAction,
  onAuthRequired,
  onDelete,
  onLike,
  onUpdate,
}: {
  review: Review
  canLike: boolean
  pendingLike: boolean
  pendingOwnerAction: boolean
  onAuthRequired: () => void
  onDelete: () => Promise<void>
  onLike: () => void
  onUpdate: (content: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const edited = review.updatedAt !== review.createdAt

  return (
    <article className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3 border-t border-white/8 py-5 first:border-t-0 first:pt-0">
      <ReviewAuthor author={review.author} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-kino-muted">
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
          {review.isViewerReview ? (
            <div className="shrink-0">
              <ReviewOwnerActions
                disabled={pendingOwnerAction}
                onDelete={() => setConfirmDelete(true)}
                onEdit={() => setEditing(true)}
              />
            </div>
          ) : null}
        </div>

        <p className="mt-1 text-xs text-kino-subtle">
          {edited ? `${t('reviews.edited')} · ` : ''}
          {formatLocalizedDate(review.updatedAt, locale)}
        </p>

        <div className="mt-3">
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
            <p className="w-full wrap-break-word whitespace-pre-wrap text-sm leading-7 text-kino-text">
              {review.content}
            </p>
          )}
        </div>

        {!review.isViewerReview ? (
          <div className="mt-3">
            <ReviewLikeButton
              canLike={canLike}
              likedByViewer={review.likedByViewer}
              likeCount={review.likeCount}
              onAuthRequired={onAuthRequired}
              onLike={onLike}
              pending={pendingLike}
            />
          </div>
        ) : null}
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
