import type { MediaType, PublicUserSummary, Review } from '@kino/core'
import { useToast } from '@/components/toast-provider'
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
import { ReviewsCarousel, ReviewsCarouselSlide } from './reviews-carousel'
import { ReviewsDialog } from './reviews-dialog'

const EMPTY_TITLE_ID = '00000000-0000-0000-0000-000000000000'

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

  const query = useTitleReviews(titleId, titleId !== EMPTY_TITLE_ID)

  const create = useCreateReviewMutation()
  const update = useUpdateReviewMutation(titleId)
  const remove = useDeleteReviewMutation(titleId)
  const like = useReviewLikeMutation(titleId)

  const reviews = query.data?.items ?? []
  const totalCount = query.data?.totalCount ?? 0

  const viewerReview = reviews.find((review) => review.isViewerReview)

  const notifyError = (key: string) => {
    toast.notify({
      tone: 'error',
      title: t(key),
    })
  }

  const renderReview = (review: Review) => (
    <ReviewCard
      context="title"
      canLike={Boolean(author)}
      key={review.id}
      onAuthRequired={onAuthRequired}
      onDelete={async () => {
        try {
          await remove.mutateAsync(review.id)

          toast.notify({
            tone: 'success',
            title: t('reviews.deleteSuccess'),
          })
        } catch {
          notifyError('reviews.deleteFailure')
        }
      }}
      onLike={() => {
        like.mutate(
          {
            reviewId: review.id,
            liked: review.likedByViewer,
            authorProfileId: review.userId,
          },
          {
            onError: () => notifyError('reviews.likeFailure'),
          }
        )
      }}
      onUpdate={async (content) => {
        try {
          await update.mutateAsync({
            reviewId: review.id,
            content,
          })

          toast.notify({
            tone: 'success',
            title: t('reviews.editSuccess'),
          })

          return true
        } catch {
          notifyError('reviews.editFailure')
          return false
        }
      }}
      pendingLike={like.isPending && like.variables?.reviewId === review.id}
      pendingOwnerAction={
        (remove.isPending && remove.variables === review.id) ||
        (update.isPending && update.variables?.reviewId === review.id)
      }
      review={review}
    />
  )

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>
        </div>

        {totalCount > 0 ? (
          <ReviewsDialog renderReview={renderReview} titleId={titleId} totalCount={totalCount} />
        ) : null}
      </div>

      {query.isLoading || authorLoading ? (
        <ReviewsCarousel>
          <ReviewsCarouselSlide>
            <ReviewSkeleton />
          </ReviewsCarouselSlide>

          <ReviewsCarouselSlide>
            <ReviewSkeleton />
          </ReviewsCarouselSlide>
        </ReviewsCarousel>
      ) : null}

      {query.isError ? <p className="text-sm text-red-300">{t('reviews.loadFailure')}</p> : null}

      {!query.isLoading && !authorLoading && !viewerReview && author ? (
        <div className={totalCount > 0 ? 'mb-5' : undefined}>
          <ReviewComposer
            author={author}
            onPublish={async (content) => {
              try {
                await create.mutateAsync({
                  titleId,
                  mediaType,
                  content,
                  author,
                })

                toast.notify({
                  tone: 'success',
                  title: t('reviews.publishSuccess'),
                })

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

      {!query.isLoading && !authorLoading && !author && !viewerAuthenticated && !totalCount ? (
        <button
          className="focus-ring rounded-md text-left text-sm text-kino-muted transition-colors hover:text-kino-text"
          onClick={onAuthRequired}
          type="button"
        >
          {t('reviews.empty.anonymous')}
        </button>
      ) : null}

      {!query.isLoading && !authorLoading && viewerAuthenticated && !author ? (
        <p className="text-sm text-red-300">{t('reviews.loadFailure')}</p>
      ) : null}

      {!query.isLoading && reviews.length > 0 ? (
        <ReviewsCarousel>
          {reviews.map((review) => (
            <ReviewsCarouselSlide key={review.id}>{renderReview(review)}</ReviewsCarouselSlide>
          ))}
        </ReviewsCarousel>
      ) : null}
    </section>
  )
}
