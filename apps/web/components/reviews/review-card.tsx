import type { Review } from '@kino/core'
import { Heart } from 'lucide-react'
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
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ReviewAuthor } from './review-author'
import { ReviewEditor } from './review-editor'
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
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const edited = review.updatedAt !== review.createdAt

  return (
    <article className="flex h-full min-h-52 min-w-0 select-text items-start gap-3.5 rounded-md border border-white/10 bg-kino-surface p-4 sm:p-5">
      <ReviewAuthor author={review.author} size="lg" />
      <div className="min-w-0 flex-1">
        {/* Header block: author + rating + owner actions live tight together,
            since they're all "about" the same reviewer row */}
        <div className="flex items-start justify-between gap-2">
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
          {review.isViewerReview ? (
            <ReviewOwnerActions
              disabled={pendingOwnerAction}
              onDelete={() => setConfirmDelete(true)}
              onEdit={() => setEditing(true)}
            />
          ) : null}
        </div>

        {/* Date is metadata about the row above it, so it stays close (mt-0.5)
            rather than floating at the same distance as unrelated content */}
        <p className="mt-0.5 text-xs text-kino-subtle">
          {edited ? `${t('reviews.edited')} · ` : ''}
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
            new Date(review.updatedAt)
          )}
        </p>

        {/* Body gets a clearly larger gap (mt-4) from the header block above it,
            marking it as the next distinct section rather than another metadata line */}
        <div className="mt-4">
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
            <p className="max-w-[70ch] whitespace-pre-wrap text-sm leading-7 text-kino-text">
              {review.content}
            </p>
          )}
        </div>

        {/* Footer is visually separated with a hairline + its own top padding,
            so likes read as an action zone rather than a trailing line of the review */}
        {!review.isViewerReview ? (
          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-sm">
            <button
              aria-pressed={review.likedByViewer}
              className={cn(
                'focus-ring inline-flex items-center gap-1.5 rounded-md px-1 py-1 font-medium transition-colors',
                review.likedByViewer ? 'text-kino-accent' : 'text-kino-muted hover:text-kino-text'
              )}
              disabled={pendingLike}
              onClick={() => (canLike ? onLike() : onAuthRequired())}
              type="button"
            >
              <Heart
                aria-hidden="true"
                fill={review.likedByViewer ? 'currentColor' : 'none'}
                size={16}
              />
              {t(review.likedByViewer ? 'reviews.unlike' : 'reviews.like')}
            </button>
            <span className="text-kino-subtle">
              {t('reviews.likeCount', { count: review.likeCount })}
            </span>
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
