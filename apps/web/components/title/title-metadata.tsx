'use client'

import type { KinoReviewAuthor, MediaType, TitleDetails, TitleRatingStats } from '@kino/core'
import { Star, Trash2, UserRound } from 'lucide-react'
import { FollowedTitleRatings } from '@/components/followed-ratings'

import { RatingStars } from '@/components/rating-stars'
import { ReviewsSection } from '@/components/reviews/reviews-section'
import { FranchiseTitles, MoreLikeThis, type TitleContextData } from '@/components/title-context'
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

/**
 * Synopsis + (movie rating card | nothing — tv seasons render separately via
 * `SeasonTabs` in title-seasons.tsx). This is the top of the page's main
 * column, shared by both media types.
 */
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
    <>
      <Card className="self-start p-5 md:p-6">
        <h2 className="text-xl font-semibold text-kino-text">
          {t('title.synopsis', { defaultValue: 'Synopsis' })}
        </h2>
        <p className="max-w-4xl text-base leading-7 text-kino-text">
          {title.synopsis ||
            t('title.noSynopsis', {
              defaultValue: 'No synopsis is available.',
            })}
        </p>
      </Card>

      {title.type === 'movie' ? (
        <div className="grid w-full min-w-0 max-w-full gap-5">
          <Card className="self-start p-5 text-center md:p-6">
            <h2 className="mb-4 text-xl font-semibold text-kino-text">{t('title.rateMovie')}</h2>
            {user ? (
              <>
                <RatingStars
                  className="self-center"
                  disabled={rateMutation.isPending}
                  onChange={(rating) => rateMutation.mutate(rating)}
                  size="lg"
                  value={currentUserRating}
                />
                {currentUserRating ? (
                  <AlertDialog>
                    <div className="mt-3 flex justify-center">
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
                      ></AlertDialogTrigger>
                    </div>
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
                ) : (
                  <p className="mt-3 text-sm text-kino-muted">{t('title.tapToRate')}</p>
                )}
              </>
            ) : (
              <Button onClick={onAuthRequired}>
                <Star size={16} />
                {t('auth.signIn')}
              </Button>
            )}
          </Card>
        </div>
      ) : null}
    </>
  )
}

/** Ratings summary card — used both in the movie main column and the tv sidebar. */
export function CommunityRatingsPanel({
  stats,
  titleId,
  type,
  showFollowed,
}: {
  stats: TitleRatingStats | undefined
  titleId: string
  type: MediaType
  showFollowed: boolean
}) {
  const { t } = useTranslation()

  return (
    <Card className="grid gap-3 p-5">
      <h2 className="text-lg font-semibold text-kino-text">{t('title.communityRatings')}</h2>
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
    </Card>
  )
}

/** Franchise titles + reviews + recommendations. Reused below the season tabs
 * for movies, and below the whole layout for tv shows. */
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
    <>
      <FranchiseTitles
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
      <MoreLikeThis
        error={contextQuery.data?.errors.recommendations || contextQuery.isError}
        items={contextQuery.data?.recommendations}
        loading={contextQuery.isLoading}
      />
    </>
  )
}
