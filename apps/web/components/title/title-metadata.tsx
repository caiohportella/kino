'use client'

import type { KinoReviewAuthor, MediaType, TitleDetails, TitleRatingStats } from '@kino/core'
import { Star, Trash2, UserRound } from 'lucide-react'
import { RatingStars } from '@/components/media/rating-stars'
import { FollowedTitleRatings } from '@/components/profile/followed-ratings'
import { ReviewsSection } from '@/components/reviews/reviews-section'
import { FranchiseTitles, type TitleContextData } from '@/components/title/title-context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n'
import { Stat } from '../kino'

/** Synopsis and compact personal activity for both movie and TV title pages. */
export function TitleSynopsisAndRating({
  title,
  user,
  currentUserRating,
  rateMutation,
  deleteMovieEntryMutation,
  onAuthRequired,
}: {
  title: TitleDetails
  user: { id: string } | null | undefined
  currentUserRating: number
  rateMutation: { mutate: (rating: number) => void; isPending: boolean }
  deleteMovieEntryMutation: { mutate: () => void; isPending: boolean }
  onAuthRequired: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h2 className="text-sm font-semibold text-kino-text">
          {t('title.synopsis', { defaultValue: 'Synopsis' })}
        </h2>
        <p className="max-w-4xl text-base leading-7 text-kino-text">
          {title.synopsis ||
            t('title.noSynopsis', {
              defaultValue: 'No synopsis is available.',
            })}
        </p>
      </div>

      {title.type === 'movie' ? (
        <div className="grid gap-3 border-t border-white/[0.07] pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-kino-subtle">
            {t('title.rateMovie')}
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {user ? (
              <RatingStars
                disabled={rateMutation.isPending}
                onChange={(rating) => rateMutation.mutate(rating)}
                size="lg"
                value={currentUserRating}
              />
            ) : (
              <Button onClick={onAuthRequired} size="sm">
                <Star size={16} />
                {t('auth.signIn')}
              </Button>
            )}

            {user && currentUserRating ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      className="text-kino-muted hover:text-red-300"
                      disabled={deleteMovieEntryMutation.isPending}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 size={16} />
                      {t('modals.deleteEntry')}
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('modals.deleteEntry')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('modals.deleteEntryConfirm')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteMovieEntryMutation.isPending}
                      onClick={() => deleteMovieEntryMutation.mutate()}
                      variant="destructive"
                    >
                      {t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : user ? (
              <p className="text-sm text-kino-muted">{t('title.tapToRate')}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Ratings summary with a standalone card or embedded structural presentation. */
export function CommunityRatingsPanel({
  embedded = false,
  stats,
  titleId,
  type,
  showFollowed,
}: {
  embedded?: boolean
  stats: TitleRatingStats | undefined
  titleId: string
  type: MediaType
  showFollowed: boolean
}) {
  const { t } = useTranslation()

  const content = (
    <div className="grid gap-3">
      <h2
        className={
          embedded ? 'text-sm font-semibold text-kino-text' : 'text-lg font-semibold text-kino-text'
        }
      >
        {t('title.communityRatings')}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Star aria-hidden="true" className="text-kino-accent" size={14} />}
          label={type === 'movie' ? t('title.avgMovieRating') : t('title.avgSeriesRating')}
          value={stats?.averageRating.toFixed(1) || '0.0'}
        />
        <Stat
          icon={<UserRound aria-hidden="true" size={14} />}
          label={t('title.userRatings')}
          value={stats?.totalRatings || 0}
        />
      </div>
      {type === 'movie' ? <FollowedTitleRatings enabled={showFollowed} titleId={titleId} /> : null}
    </div>
  )

  return embedded ? content : <Card className="grid gap-3 p-5">{content}</Card>
}

/** Franchise titles and reviews for the shared movie/TV discovery section. */
export function TitleDiscoverySection({
  title,
  user,
  reviewAuthor,
  reviewAuthorLoading,
  currentUserRating,
  contextQuery,
  onAuthRequired,
}: {
  title: TitleDetails
  user: { id: string } | null | undefined
  reviewAuthor: KinoReviewAuthor | null
  reviewAuthorLoading: boolean
  currentUserRating: number
  contextQuery: {
    data: TitleContextData | undefined
    isLoading: boolean
    isError: boolean
  }
  onAuthRequired: () => void
}) {
  return (
    <div className="grid gap-8 md:gap-10">
      <FranchiseTitles
        embedded
        items={contextQuery.data?.franchiseTitles}
        loading={contextQuery.isLoading}
      />
      <ReviewsSection
        author={reviewAuthor}
        authorLoading={reviewAuthorLoading}
        currentRating={currentUserRating || null}
        mediaType={title.type}
        onAuthRequired={onAuthRequired}
        titleId={title.id}
        viewerAuthenticated={Boolean(user)}
      />
    </div>
  )
}
