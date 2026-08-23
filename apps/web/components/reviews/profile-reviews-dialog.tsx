import type { ProfileReview } from '@kino/core'
import { DisplayTitle } from '@/components/media/display-title'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAllProfileReviews } from '@/hooks/profile/use-profile-reviews'
import { useTranslation } from '@/lib/localization/i18n'
import { ProfileReviewSkeleton } from './profile-review-skeleton'

export function ProfileReviewsDialog({
  open,
  onOpenChange,
  renderReview,
  username,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  renderReview: (review: ProfileReview) => React.ReactNode
  username: string
}) {
  const { t } = useTranslation()
  const query = useAllProfileReviews(username, open)
  const reviews = query.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black italic tracking-normal sm:text-3xl">
            <DisplayTitle title={t('reviews.latest')} />
          </DialogTitle>
          <DialogDescription>{t('reviews.showAllDescription')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[72vh] overflow-y-auto pr-1">
          {query.isLoading ? (
            <div className="grid gap-4">
              <ProfileReviewSkeleton />
              <ProfileReviewSkeleton />
            </div>
          ) : (
            <div className="grid gap-4">{reviews.map(renderReview)}</div>
          )}
          {query.hasNextPage ? (
            <div className="mt-5 flex justify-center">
              <Button
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                variant="secondary"
              >
                {query.isFetchingNextPage ? t('common.loading') : t('reviews.showMore')}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
