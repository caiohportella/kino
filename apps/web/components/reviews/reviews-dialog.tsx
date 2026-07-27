'use client'

import type { Review } from '@kino/core'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n'
import { db } from '@/lib/services'
import { ReviewSkeleton } from './review-skeleton'

export function ReviewsDialog({
  titleId,
  totalCount,
  renderReview,
}: {
  titleId: string
  totalCount: number
  renderReview: (review: Review) => React.ReactNode
}) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['title-reviews', titleId, 'all'],
    queryFn: () => db.getTitleReviews(titleId, 50),
    enabled: false,
  })

  if (totalCount <= 6) return null
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open && !query.data) void query.refetch()
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost">
            {t('reviews.showAll')}
          </Button>
        }
      />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('reviews.title')}</DialogTitle>
          <DialogDescription>{t('reviews.showAllDescription')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          {query.isLoading ? <ReviewSkeleton /> : query.data?.items.map(renderReview)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
