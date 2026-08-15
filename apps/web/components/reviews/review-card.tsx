import type { ProfileReview, Review } from '@kino/core'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Poster } from '@/components/kino'
import { RatingStars } from '@/components/media/rating-stars'
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

type SharedReviewCardProps = {
  canLike: boolean
  pendingLike: boolean
  pendingOwnerAction: boolean
  onAuthRequired: () => void
  onDelete: () => Promise<void>
  onLike: () => void
  onUpdate: (content: string) => Promise<boolean>
}

type ReviewCardProps =
  | (SharedReviewCardProps & {
      context: 'profile'
      review: ProfileReview
    })
  | (SharedReviewCardProps & {
      context: 'title'
      review: Review
    })

export function ReviewCard(props: ReviewCardProps) {
  const { canLike, onAuthRequired, onDelete, onLike, onUpdate, pendingLike, pendingOwnerAction } =
    props

  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (props.context === 'profile') {
    return (
      <>
        <ProfileReviewLayout
          review={props.review}
          editing={editing}
          pendingLike={pendingLike}
          pendingOwnerAction={pendingOwnerAction}
          canLike={canLike}
          onAuthRequired={onAuthRequired}
          onLike={onLike}
          onUpdate={onUpdate}
          onEdit={() => setEditing(true)}
          onCancelEdit={() => setEditing(false)}
          onDelete={() => setConfirmDelete(true)}
        />

        <ReviewDeleteDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          pending={pendingOwnerAction}
          onDelete={onDelete}
        />
      </>
    )
  }

  const titleReview = props.review
  const reviewDate = new Date(titleReview.createdAt)
  const edited = titleReview.updatedAt !== titleReview.createdAt

  return (
    <>
      <article className="flex h-full min-w-0 select-text items-start gap-3.5 rounded-md border border-white/10 bg-kino-surface p-4 sm:gap-4 sm:p-5">
        <ReviewAuthor author={titleReview.author} size="lg" />

        <div className="min-w-0 flex-1">
          <header className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                <ReviewAuthor author={titleReview.author} variant="name" />

                <span aria-hidden="true" className="text-kino-subtle">
                  ·
                </span>

                <time className="text-xs text-kino-subtle" dateTime={reviewDate.toISOString()}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                  }).format(reviewDate)}
                </time>

                {edited ? (
                  <>
                    <span aria-hidden="true" className="text-kino-subtle">
                      ·
                    </span>

                    <span className="text-xs text-kino-subtle">{t('reviews.edited')}</span>
                  </>
                ) : null}
              </div>

              {titleReview.rating ? (
                <div className="mt-1.5 flex items-center">
                  <RatingStars
                    label={t('reviews.ratingLabel')}
                    readonly
                    size="xs"
                    value={titleReview.rating}
                  />
                </div>
              ) : null}
            </div>

            {titleReview.isViewerReview ? (
              <ReviewOwnerActions
                disabled={pendingOwnerAction}
                onDelete={() => setConfirmDelete(true)}
                onEdit={() => setEditing(true)}
              />
            ) : null}
          </header>

          <div className="mt-3.5">
            {editing ? (
              <ReviewEditor
                initialContent={titleReview.content}
                onCancel={() => setEditing(false)}
                onSave={async (content) => {
                  const saved = await onUpdate(content)

                  if (saved) {
                    setEditing(false)
                  }

                  return saved
                }}
                pending={pendingOwnerAction}
              />
            ) : (
              <ExpandableReviewContent content={titleReview.content} />
            )}
          </div>

          {!titleReview.isViewerReview ? (
            <div className="mt-4 flex items-center gap-1.5 text-sm">
              <button
                aria-label={t(titleReview.likedByViewer ? 'reviews.unlike' : 'reviews.like')}
                aria-pressed={titleReview.likedByViewer}
                className={cn(
                  'focus-ring inline-flex items-center gap-1.5 rounded-md py-1 pr-1.5 transition-colors',
                  titleReview.likedByViewer
                    ? 'text-kino-accent'
                    : 'text-kino-subtle hover:text-kino-text'
                )}
                disabled={pendingLike}
                onClick={() => (canLike ? onLike() : onAuthRequired())}
                type="button"
              >
                <Heart
                  aria-hidden="true"
                  fill={titleReview.likedByViewer ? 'currentColor' : 'none'}
                  size={16}
                />

                <span>
                  {t('reviews.likeCount', {
                    count: titleReview.likeCount,
                  })}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </article>

      <ReviewDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        pending={pendingOwnerAction}
        onDelete={onDelete}
      />
    </>
  )
}

function ReviewDeleteDialog({
  open,
  onOpenChange,
  pending,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onDelete: () => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('reviews.delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('reviews.deleteConfirm')}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>

          <AlertDialogAction
            disabled={pending}
            onClick={() => void onDelete()}
            variant="destructive"
          >
            {t('reviews.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProfileReviewLayout({
  review,
  editing,
  pendingLike,
  pendingOwnerAction,
  canLike,
  onAuthRequired,
  onLike,
  onUpdate,
  onEdit,
  onCancelEdit,
  onDelete,
}: {
  review: ProfileReview
  editing: boolean
  pendingLike: boolean
  pendingOwnerAction: boolean
  canLike: boolean
  onAuthRequired: () => void
  onLike: () => void
  onUpdate: (content: string) => Promise<boolean>
  onEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()

  const localizedRequest = useMemo(
    () => ({
      tmdbId: review.title.tmdbId,
      type: review.title.mediaType,
    }),
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
    return <ProfileReviewSkeleton />
  }

  const displayTitle =
    localizedTitle.status === 'ready' ? localizedTitle.title : t('reviews.titleUnavailable')

  const href = titlePath(review.title.tmdbId, displayTitle, review.title.mediaType)

  const posterUrl = getTmdb().getImageUrl(
    localizedTitle.posterPath || review.title.posterUrl,
    'w300'
  )

  const reviewDate = new Date(review.createdAt)
  const edited = review.updatedAt !== review.createdAt

  return (
    <article className="flex h-63 min-w-0 flex-col overflow-hidden rounded-md border border-white/10 bg-kino-surface p-4 transition-colors hover:border-white/15">
      {/* Title stays above both poster + review */}
      <div className="shrink-0">
        <Link
          className="focus-ring inline rounded-sm font-semibold text-kino-text transition-colors hover:text-kino-accent"
          href={href}
        >
          {displayTitle}
        </Link>

        {localizedTitle.year ? (
          <span className="ml-1.5 text-sm font-normal text-kino-muted">
            ({localizedTitle.year})
          </span>
        ) : null}
      </div>

      {/* Poster now begins where reviews.reviewedTitle used to be */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-[64px_minmax(0,1fr)] gap-4">
        <Link
          aria-label={t('reviews.openForTitle', {
            title: displayTitle,
          })}
          className="focus-ring block self-start rounded-md"
          href={href}
        >
          <Poster className="w-full" src={posterUrl} title={displayTitle} />
        </Link>

        <div className="flex min-h-0 min-w-0 flex-col">
          {/* Author / date / actions */}
          <header className="flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                <ReviewAuthor author={review.author} variant="name" />

                <span aria-hidden="true" className="text-kino-subtle">
                  ·
                </span>

                <time className="text-xs text-kino-subtle" dateTime={reviewDate.toISOString()}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                  }).format(reviewDate)}
                </time>

                {edited ? (
                  <>
                    <span aria-hidden="true" className="text-kino-subtle">
                      ·
                    </span>

                    <span className="text-xs text-kino-subtle">{t('reviews.edited')}</span>
                  </>
                ) : null}
              </div>

              {review.rating ? (
                <div className="mt-1.5">
                  <RatingStars
                    label={t('reviews.ratingLabel')}
                    readonly
                    size="xs"
                    value={review.rating}
                  />
                </div>
              ) : null}
            </div>

            {review.isViewerReview ? (
              <ReviewOwnerActions
                disabled={pendingOwnerAction}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ) : null}
          </header>

          {/* Review body */}
          <div className="mt-3 min-h-0 flex-1">
            {editing ? (
              <ReviewEditor
                initialContent={review.content}
                onCancel={onCancelEdit}
                onSave={async (content) => {
                  const saved = await onUpdate(content)

                  if (saved) {
                    onCancelEdit()
                  }

                  return saved
                }}
                pending={pendingOwnerAction}
              />
            ) : (
              <p className="line-clamp-4 wrap-break-word whitespace-pre-wrap text-sm leading-6 text-kino-text">
                {review.content}
              </p>
            )}
          </div>

          {/* Always pinned to bottom */}
          <div className="mt-2 flex shrink-0 items-center border-t border-white/10 pt-2">
            {!review.isViewerReview ? (
              <button
                aria-label={t(review.likedByViewer ? 'reviews.unlike' : 'reviews.like')}
                aria-pressed={review.likedByViewer}
                className={cn(
                  'focus-ring inline-flex items-center gap-1.5 rounded-md py-1 pr-1.5 text-sm transition-colors',
                  review.likedByViewer
                    ? 'text-kino-accent'
                    : 'text-kino-subtle hover:text-kino-text'
                )}
                disabled={pendingLike}
                onClick={() => {
                  if (canLike) {
                    onLike()
                  } else {
                    onAuthRequired()
                  }
                }}
                type="button"
              >
                <Heart
                  aria-hidden="true"
                  fill={review.likedByViewer ? 'currentColor' : 'none'}
                  size={16}
                />

                {t('reviews.likeCount', {
                  count: review.likeCount,
                })}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-kino-subtle">
                <Heart aria-hidden="true" size={16} />

                <span>
                  {t('reviews.likeCount', {
                    count: review.likeCount,
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function ExpandableReviewContent({ content }: { content: string }) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLParagraphElement>(null)

  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)

  useEffect(() => {
    const element = contentRef.current
    if (!element) return

    const checkOverflow = () => {
      setCanExpand(element.scrollHeight > element.clientHeight + 1)
    }

    checkOverflow()

    const observer = new ResizeObserver(checkOverflow)
    observer.observe(element)

    return () => observer.disconnect()
  }, [content])

  return (
    <div>
      <p
        className={cn(
          'max-w-[70ch] whitespace-pre-wrap text-sm leading-6 text-kino-text',
          !expanded && 'line-clamp-4'
        )}
        ref={contentRef}
      >
        {content}
      </p>

      {canExpand || expanded ? (
        <button
          className="focus-ring mt-2 rounded-sm text-sm font-medium text-kino-muted transition-colors hover:text-kino-text"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {t(expanded ? 'reviews.showLess' : 'reviews.showMore')}
        </button>
      ) : null}
    </div>
  )
}
