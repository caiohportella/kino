'use client'

import type { ProfileReview } from '@kino/core'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { useProfileReviewMutations, useProfileReviews } from '@/hooks/use-profile-reviews'
import { storeAuthRedirect } from '@/lib/auth-redirect'
import { useTranslation } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth-store'

import { ProfileReviewCard } from './profile-review-card'
import { ProfileReviewSkeleton } from './profile-review-skeleton'
import { ProfileReviewsDialog } from './profile-reviews-dialog'
import { ReviewsCarousel, ReviewsCarouselSlide } from './reviews-carousel'

export function ProfileReviewsSection({ username }: { username: string }) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()

  const query = useProfileReviews(username)
  const mutations = useProfileReviewMutations(username)

  const [showAllOpen, setShowAllOpen] = useState(false)

  const onAuthRequired = () => {
    storeAuthRedirect(pathname)
    router.push('/auth/login')
  }

  const notifyError = (key: string) => {
    toast.notify({
      tone: 'error',
      title: t(key),
    })
  }

  const renderReview = (review: ProfileReview) => (
    <ProfileReviewCard
      canLike={Boolean(user)}
      key={review.id}
      onAuthRequired={onAuthRequired}
      onDelete={async () => {
        try {
          await mutations.remove.mutateAsync(review)

          toast.notify({
            tone: 'success',
            title: t('reviews.deleteSuccess'),
          })
        } catch {
          notifyError('reviews.deleteFailure')
        }
      }}
      onLike={() => {
        mutations.like.mutate(
          {
            review,
            liked: review.likedByViewer,
          },
          {
            onError: () => notifyError('reviews.likeFailure'),
          }
        )
      }}
      onUpdate={async (content) => {
        try {
          await mutations.update.mutateAsync({
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
      pendingLike={mutations.like.isPending && mutations.like.variables?.review.id === review.id}
      pendingOwnerAction={
        (mutations.remove.isPending && mutations.remove.variables?.id === review.id) ||
        (mutations.update.isPending && mutations.update.variables?.reviewId === review.id)
      }
      review={review}
    />
  )

  if (query.isLoading) {
    return (
      <section aria-label={t('reviews.title')} className="mb-10 min-w-0">
        <h2 className="mb-4 text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>

        <ReviewsCarousel>
          <ReviewsCarouselSlide>
            <ProfileReviewSkeleton />
          </ReviewsCarouselSlide>

          <ReviewsCarouselSlide>
            <ProfileReviewSkeleton />
          </ReviewsCarouselSlide>
        </ReviewsCarousel>
      </section>
    )
  }

  if (query.isError || !query.data?.totalCount) {
    return null
  }

  return (
    <section className="mb-10 min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>

        {query.data.totalCount > query.data.items.length ? (
          <Button onClick={() => setShowAllOpen(true)} size="sm" variant="ghost">
            {t('reviews.showAll')}
          </Button>
        ) : null}
      </div>

      <ReviewsCarousel>
        {query.data.items.map((review) => (
          <ReviewsCarouselSlide key={review.id}>{renderReview(review)}</ReviewsCarouselSlide>
        ))}
      </ReviewsCarousel>

      <ProfileReviewsDialog
        onOpenChange={setShowAllOpen}
        open={showAllOpen}
        renderReview={renderReview}
        username={username}
      />
    </section>
  )
}
