'use client'

import type { KinoReviewAuthor, MediaType, TitleDetails, TitleRatingStats } from '@kino/core'
import { Star, Trash2, UserRound } from 'lucide-react'
import { FollowedTitleRatings } from '@/components/profile/followed-ratings'
import { ReviewsSection } from '@/components/reviews/reviews-section'
import { FranchiseTitles, type TitleContextData } from '@/components/title/title-context'
import { Card } from '@/components/ui/card'
import { useTranslation } from '@/lib/localization/i18n'
import { Stat } from '../kino'
import { RatingStars } from '../media/rating-stars'
import { Button } from '../ui/button'

export function TitleSynopsis({ title }: { title: TitleDetails }) {
  const { t } = useTranslation()

  return (
    <div className="grid w-full min-w-0 gap-3">
      <h2 className="text-base font-semibold text-kino-text lg:text-lg">
        {t('title.synopsis', {
          defaultValue: 'Synopsis',
        })}
      </h2>

      <p
        className="
          w-full max-w-none
          text-base leading-7 text-kino-text
          lg:text-lg lg:leading-8
        "
      >
        {title.synopsis ||
          t('title.noSynopsis', {
            defaultValue: 'No synopsis is available.',
          })}
      </p>
    </div>
  )
}

export function CommunityRatingsPanel({
  embedded = false,
  stats,
  titleId,
  type,
  showFollowed,
  viewerAuthenticated,
  currentUserRating,
  rateMutation,
  deleteMovieEntryMutation,
  onAuthRequired,
}: {
  embedded?: boolean
  stats: TitleRatingStats | undefined
  titleId: string
  type: MediaType
  showFollowed: boolean
  viewerAuthenticated: boolean
  currentUserRating: number
  rateMutation: {
    mutate: (rating: number) => void
    isPending: boolean
  }
  deleteMovieEntryMutation: {
    mutate: () => void
    isPending: boolean
  }
  onAuthRequired: () => void
}) {
  const { t } = useTranslation()

  const content = (
    <div className="grid gap-3">
      <h2
        className={
          embedded
            ? 'text-base font-semibold text-kino-text lg:text-lg'
            : 'text-lg font-semibold text-kino-text'
        }
      >
        {t('title.communityRatings')}
      </h2>

      <div
        className={
          type === 'movie'
            ? 'grid grid-cols-1 overflow-hidden rounded-md border border-white/10 bg-white/4 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid grid-cols-1 overflow-hidden rounded-md border border-white/10 bg-white/4 sm:grid-cols-2'
        }
      >
        {type === 'movie' ? (
          <div
            className="
              flex min-w-0 flex-col
              border-b border-white/10
              px-5 py-4

              sm:col-span-2

              lg:border-b-0
              lg:border-r
              lg:px-6
            "
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-kino-subtle">
              {t('title.rateMovie')}
            </div>

            {viewerAuthenticated ? (
              <div
                className="
                  mt-3
                  flex min-w-0
                  flex-col items-start
                  gap-3

                  sm:flex-row
                  sm:flex-wrap
                  sm:items-center
                  sm:gap-4
                "
              >
                <RatingStars
                  className="shrink-0"
                  disabled={rateMutation.isPending}
                  onChange={(rating) => rateMutation.mutate(rating)}
                  size="lg"
                  value={currentUserRating}
                />

                {currentUserRating ? (
                  <Button
                    className="
                      h-auto
                      px-0 py-1
                      text-kino-muted
                      hover:bg-transparent
                      hover:text-red-300
                    "
                    disabled={deleteMovieEntryMutation.isPending}
                    onClick={() => deleteMovieEntryMutation.mutate()}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 size={15} />
                    {t('modals.deleteEntry')}
                  </Button>
                ) : (
                  <span className="text-sm text-kino-muted">{t('title.tapToRate')}</span>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <Button onClick={onAuthRequired} size="sm">
                  <Star size={16} />
                  {t('auth.signIn')}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        <div
          className="
            flex min-w-0
            items-center gap-4
            border-b border-white/10
            px-5 py-4

            sm:border-b-0
            sm:border-r

            lg:px-6
          "
        >
          <div className="shrink-0 text-2xl font-semibold text-kino-text">
            {stats?.averageRating.toFixed(1) || '0.0'}
          </div>

          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-kino-muted">
            <Star aria-hidden="true" className="shrink-0 text-kino-accent" size={16} />

            <span className="min-w-0">
              {type === 'movie' ? t('title.avgMovieRating') : t('title.avgSeriesRating')}
            </span>
          </div>
        </div>

        <div
          className="
            flex min-w-0
            items-center gap-4
            px-5 py-4

            lg:px-6
          "
        >
          <div className="shrink-0 text-2xl font-semibold text-kino-text">
            {stats?.totalRatings || 0}
          </div>

          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-kino-muted">
            <UserRound aria-hidden="true" className="shrink-0 text-kino-muted" size={16} />

            <span className="min-w-0">{t('title.userRatings')}</span>
          </div>
        </div>
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
    <div className="grid gap-10 lg:gap-14">
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
