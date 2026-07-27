'use client'

import type { ProfileReview } from '@kino/core'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import {
  useProfileReviewMutations,
  useProfileReviews,
} from '@/hooks/use-profile-reviews'
import { storeAuthRedirect } from '@/lib/auth-redirect'
import { useTranslation } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth-store'
import { ProfileReviewCard } from './profile-review-card'
import { ProfileReviewSkeleton } from './profile-review-skeleton'
import { ProfileReviewsDialog } from './profile-reviews-dialog'

export function ProfileReviewsSection({ username }: { username: string }) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const query = useProfileReviews(username)
  const mutations = useProfileReviewMutations(username)
  const [showAllOpen, setShowAllOpen] = useState(false)

  if (query.isLoading) {
    return (
      <section aria-label={t('reviews.title')} className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ProfileReviewSkeleton />
          <ProfileReviewSkeleton />
        </div>
      </section>
    )
  }

  if (query.isError || !query.data?.totalCount) return null

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
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>
        {query.data.totalCount > query.data.items.length ? (
          <Button onClick={() => setShowAllOpen(true)} size="sm" variant="ghost">
            {t('reviews.showAll')}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{query.data.items.map(renderReview)}</div>
      <ProfileReviewsDialog
        onOpenChange={setShowAllOpen}
        open={showAllOpen}
        renderReview={renderReview}
        username={username}
      />
    </section>
  )
}
