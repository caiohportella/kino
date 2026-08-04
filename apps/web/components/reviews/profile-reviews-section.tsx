'use client'
import type { ProfileReview } from '@kino/core'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useToast } from '@/components/toast-provider'
import { Button } from '@/components/ui/button'
import { useProfileReviewMutations, useProfileReviews } from '@/hooks/use-profile-reviews'
import { storeAuthRedirect } from '@/lib/auth-redirect'
import { useTranslation } from '@/lib/i18n'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { useAuthStore } from '@/stores/auth-store'
import { ProfileHorizontalRow } from '../profile-horizontal-row'
import { ProfileReviewCard } from './profile-review-card'
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

  const localizedTitleRequests = useMemo(
    () =>
      (query.data?.items ?? []).map((review) => ({
        tmdbId: review.title.tmdbId,
        type: review.title.mediaType,
      })),
    [query.data?.items]
  )
  const localizedTitles = useLocalizedTitles(localizedTitleRequests)

  if (query.isLoading && !query.data) return null

  if (query.isError && !query.data) {
    return (
      <section aria-label={t('reviews.title')} className="mb-10" role="alert">
        <h2 className="mb-4 text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>
        <p className="text-sm text-red-300">{t('reviews.loadFailure')}</p>
      </section>
    )
  }

  if (!query.data?.totalCount) return null

  const onAuthRequired = () => {
    storeAuthRedirect(pathname)
    router.push('/auth/login')
  }

  const notifyError = (key: string) => toast.notify({ tone: 'error', title: t(key) })

  const renderReview = (review: ProfileReview) => {
    const localized =
      localizedTitles.data[
        localizedTitleKey({ tmdbId: review.title.tmdbId, type: review.title.mediaType })
      ]

    return (
      <ProfileReviewCard
        canLike={Boolean(user)}
        key={review.id}
        localizedTitle={
          localized
            ? {
                title: localized.title,
                posterUrl: localized.posterPath,
                year: localized.year,
              }
            : null
        }
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
  }

  const hasMore = query.data.totalCount > query.data.items.length

  return (
    <>
      {query.isError ? (
        <p className="mb-3 text-sm text-red-300" role="alert">
          {t('reviews.loadFailure')}
        </p>
      ) : null}
      <ProfileHorizontalRow
        action={
          hasMore ? (
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
        rowClassName="media-row--reviews [--profile-row-gap:1rem] gap-[var(--profile-row-gap)]"
        title={t('reviews.title')}
      >
        {query.data.items.map(renderReview)}
      </ProfileHorizontalRow>
    </>
  )
}
