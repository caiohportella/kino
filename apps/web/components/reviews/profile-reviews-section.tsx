'use client'

import type { ProfileReview } from '@kino/core'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ProfileHorizontalRow } from '@/components/profile-horizontal-row'
import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { useProfileReviewMutations, useProfileReviews } from '@/hooks/use-profile-reviews'
import { storeAuthRedirect } from '@/lib/auth-redirect'
import { useTranslation } from '@/lib/i18n'
import { resolveProfileReviewsQueryState } from '@/lib/profile-review-query-state'
import { useAuthStore } from '@/stores/auth-store'
import { ProfileReviewCard } from './profile-review-card'
import { ProfileReviewSkeleton } from './profile-review-skeleton'
import { ProfileReviewsDialog } from './profile-reviews-dialog'

const PROFILE_REVIEW_ROW_CLASS_NAME =
  '[--profile-row-gap:1rem] snap-x snap-mandatory [&_.media-row-track]:w-full [&_.media-row-track]:auto-cols-[calc(100%-2rem)] [&_.media-row-track]:gap-[var(--profile-row-gap)] [&_.media-row-track>*]:!w-auto md:[&_.media-row-track]:auto-cols-[calc((100%-var(--profile-row-gap))/2)]'

export function ProfileReviewsSection({ username }: { username: string }) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const query = useProfileReviews(username)
  const mutations = useProfileReviewMutations(username)
  const [showAllOpen, setShowAllOpen] = useState(false)
  const reviewState = resolveProfileReviewsQueryState(query)

  if (reviewState.kind === 'pending') {
    return (
      <ProfileHorizontalRow
        aria-busy={true}
        rowClassName={PROFILE_REVIEW_ROW_CLASS_NAME}
        title={t('reviews.title')}
      >
        {Array.from({ length: 2 }, (_, index) => (
          <div className="h-full w-full snap-start" key={`profile-review-skeleton-${index}`}>
            <ProfileReviewSkeleton />
          </div>
        ))}
      </ProfileHorizontalRow>
    )
  }

  if (reviewState.kind === 'error') {
    return (
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>
        <p className="text-sm text-red-300" role="alert">
          {t('reviews.loadFailure')}
        </p>
      </section>
    )
  }

  if (reviewState.kind === 'empty') return null

  const onAuthRequired = () => {
    storeAuthRedirect(pathname)
    router.push('/auth/login')
  }
  const notifyError = (key: string) => toast.notify({ tone: 'error', title: t(key) })
  const renderReview = (review: ProfileReview) => (
    <ProfileReviewCard
      canLike={Boolean(user)}
      key={review.id}
      onAuthRequired={onAuthRequired}
      onDelete={async () => {
        try {
          await mutations.remove.mutateAsync(review)
          toast.notify({ tone: 'success', title: t('reviews.deleteSuccess') })
        } catch {
          notifyError('reviews.deleteFailure')
        }
      }}
      onLike={() =>
        mutations.like.mutate(
          { review, liked: review.likedByViewer },
          { onError: () => notifyError('reviews.likeFailure') }
        )
      }
      onUpdate={async (content) => {
        try {
          await mutations.update.mutateAsync({ reviewId: review.id, content })
          toast.notify({ tone: 'success', title: t('reviews.editSuccess') })
          return true
        } catch {
          notifyError('reviews.editFailure')
          return false
        }
      }}
      pendingLike={mutations.like.isPending && mutations.like.variables?.review.id === review.id}
      pendingOwnerAction={mutations.remove.isPending || mutations.update.isPending}
      review={review}
    />
  )

  return (
    <ProfileHorizontalRow
      action={
        reviewState.data.totalCount > reviewState.data.items.length ? (
          <Button onClick={() => setShowAllOpen(true)} size="sm" variant="ghost">
            {t('reviews.showAll')}
          </Button>
        ) : null
      }
      after={
        <ProfileReviewsDialog
          onOpenChange={setShowAllOpen}
          open={showAllOpen}
          renderReview={renderReview}
          username={username}
        />
      }
      aria-busy={query.isFetching}
      notice={
        query.isError ? (
          <p className="mb-3 text-sm text-red-300" role="status">
            {t('reviews.loadFailure')}
          </p>
        ) : null
      }
      rowClassName={PROFILE_REVIEW_ROW_CLASS_NAME}
      title={t('reviews.title')}
    >
      {reviewState.data.items.map((review) => (
        <div className="h-full w-full snap-start" key={review.id}>
          {renderReview(review)}
        </div>
      ))}
    </ProfileHorizontalRow>
  )
}
