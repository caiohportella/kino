import type { MediaType, PublicUserSummary, Review } from '@kino/core'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useCreateReviewMutation,
  useDeleteReviewMutation,
  useReviewLikeMutation,
  useTitleReviews,
  useUpdateReviewMutation,
} from '~/hooks/data/useTitleReviews'
import { ReviewCard } from './ReviewCard'
import { ReviewComposer } from './ReviewComposer'
import { ReviewSkeleton } from './ReviewSkeleton'

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
  const query = useTitleReviews(titleId)
  const create = useCreateReviewMutation(titleId)
  const update = useUpdateReviewMutation(titleId)
  const remove = useDeleteReviewMutation(titleId)
  const like = useReviewLikeMutation(titleId)
  const viewerReview = query.data?.items.find((review) => review.isViewerReview)
  const fail = (key: string) => Alert.alert(t('common.error'), t(key))

  const renderReview = (review: Review) => (
    <ReviewCard
      authenticated={Boolean(author)}
      key={review.id}
      onAuthRequired={onAuthRequired}
      onDelete={async () => {
        try {
          await remove.mutateAsync(review.id)
        } catch {
          fail('reviews.deleteFailure')
        }
      }}
      onLike={() =>
        like.mutate(
          { reviewId: review.id, liked: review.likedByViewer },
          { onError: () => fail('reviews.likeFailure') }
        )
      }
      onUpdate={async (content) => {
        try {
          await update.mutateAsync({ reviewId: review.id, content })
          return true
        } catch {
          fail('reviews.editFailure')
          return false
        }
      }}
      pending={like.isPending || update.isPending || remove.isPending}
      review={review}
    />
  )

  return (
    <View className="mb-6 rounded-xl border border-black/50 bg-surface p-4">
      <Text className="mb-4 text-lg font-bold text-text-primary">{t('reviews.title')}</Text>
      {query.isLoading || authorLoading ? <ReviewSkeleton /> : null}
      {!query.isLoading && !authorLoading && author && !viewerReview ? (
        <ReviewComposer
          author={author}
          onPublish={async (content) => {
            try {
              await create.mutateAsync({ mediaType, content, author })
              return true
            } catch {
              fail('reviews.publishFailure')
              return false
            }
          }}
          pending={create.isPending}
          rating={currentRating}
        />
      ) : null}
      {!query.isLoading &&
      !authorLoading &&
      !author &&
      !viewerAuthenticated &&
      !query.data?.totalCount ? (
        <TouchableOpacity onPress={onAuthRequired}>
          <Text className="text-sm text-text-secondary">{t('reviews.empty.anonymous')}</Text>
        </TouchableOpacity>
      ) : null}
      {!query.isLoading && !authorLoading && viewerAuthenticated && !author ? (
        <Text className="text-sm text-red-400">{t('reviews.loadFailure')}</Text>
      ) : null}
      {query.data?.items.map(renderReview)}
    </View>
  )
}
