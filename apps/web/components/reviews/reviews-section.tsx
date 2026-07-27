'use client'

import type { MediaType, PublicUserSummary, Review } from '@kino/core'
import { useToast } from '@/components/toast-provider'
import { Card } from '@/components/ui/card'
import {
  useCreateReviewMutation,
  useDeleteReviewMutation,
  useReviewLikeMutation,
  useTitleReviews,
  useUpdateReviewMutation,
} from '@/hooks/use-title-reviews'
import { useTranslation } from '@/lib/i18n'
import { ReviewCard } from './review-card'
import { ReviewComposer } from './review-composer'
import { ReviewSkeleton } from './review-skeleton'
import { ReviewsDialog } from './reviews-dialog'

export function ReviewsSection({
  author,
  authorLoading = false,
  currentRating,
  mediaType,
  onAuthRequired,
  titleId,
  viewerAuthenticated = false,
}: {
  author: PublicUserSummary | null
  authorLoading?: boolean
  currentRating: number | null
  mediaType: MediaType
  onAuthRequired: () => void
  titleId: string
  viewerAuthenticated?: boolean
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const query = useTitleReviews(titleId, titleId !== '00000000-0000-0000-0000-000000000000')
  const create = useCreateReviewMutation()
  const update = useUpdateReviewMutation(titleId)
  const remove = useDeleteReviewMutation(titleId)
  const like = useReviewLikeMutation(titleId)
  const viewerReview = query.data?.items.find((review) => review.isViewerReview)

  const notifyError = (key: string) => toast.notify({ tone: 'error', title: t(key) })
  const renderReview = (review: Review) => (
    <ReviewCard
      canLike={Boolean(author)}
      key={review.id}
      onAuthRequired={onAuthRequired}
      onDelete={async () => {
        try {
          await remove.mutateAsync(review.id)
          toast.notify({ tone: 'success', title: t('reviews.deleteSuccess') })
        } catch {
          notifyError('reviews.deleteFailure')
        }
      }}
      onLike={() =>
        like.mutate(
          { reviewId: review.id, liked: review.likedByViewer },
          { onError: () => notifyError('reviews.likeFailure') }
        )
      }
      onUpdate={async (content) => {
        try {
          await update.mutateAsync({ reviewId: review.id, content })
          toast.notify({ tone: 'success', title: t('reviews.editSuccess') })
          return true
        } catch {
          notifyError('reviews.editFailure')
          return false
        }
      }}
      pendingLike={like.isPending && like.variables?.reviewId === review.id}
      pendingOwnerAction={remove.isPending || update.isPending}
      review={review}
    />
  )

  return (
    <Card className="p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>
        <ReviewsDialog
          renderReview={renderReview}
          titleId={titleId}
          totalCount={query.data?.totalCount ?? 0}
        />
      </div>

      {query.isLoading || authorLoading ? <ReviewSkeleton /> : null}
      {query.isError ? (
        <p className="text-sm text-red-300">{t('reviews.loadFailure')}</p>
      ) : null}

      {!query.isLoading && !authorLoading && !viewerReview && author ? (
        <div className="grid gap-3">
          {!query.data?.totalCount ? (
            <p className="text-sm text-kino-muted">{t('reviews.empty.authenticated')}</p>
          ) : null}
          <ReviewComposer
            author={author}
            onPublish={async (content) => {
              try {
                await create.mutateAsync({ titleId, mediaType, content, author })
                toast.notify({ tone: 'success', title: t('reviews.publishSuccess') })
                return true
              } catch {
                notifyError('reviews.publishFailure')
                return false
              }
            }}
            pending={create.isPending}
            rating={currentRating}
          />
        </div>
      ) : null}

      {!query.isLoading &&
      !authorLoading &&
      !author &&
      !viewerAuthenticated &&
      !query.data?.totalCount ? (
        <button
          className="focus-ring rounded-md text-left text-sm text-kino-muted hover:text-kino-text"
          onClick={onAuthRequired}
          type="button"
        >
          {t('reviews.empty.anonymous')}
        </button>
      ) : null}
      {!query.isLoading && !authorLoading && viewerAuthenticated && !author ? (
        <p className="text-sm text-red-300">{t('reviews.loadFailure')}</p>
      ) : null}

      {query.data?.items.map(renderReview)}
    </Card>
  )
}
