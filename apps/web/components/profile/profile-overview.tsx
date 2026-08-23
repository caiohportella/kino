'use client'

import type { PublicWatchlistSummary, WatchedMovie, WatchedSeries } from '@kino/core'
import { EmptyState } from '@/components/kino'
import { ProfileMovieShelf } from '@/components/profile/profile-movie-shelf'
import {
  type ProfileQueryResult,
  ProfileSectionState,
} from '@/components/profile/profile-section-state'
import { ProfileSeriesShelf } from '@/components/profile/profile-series-shelf'
import { ProfileWatchlistShelf } from '@/components/profile/profile-watchlist-shelf'
import { ProfileReviewSkeleton } from '@/components/reviews/profile-review-skeleton'
import { ProfileReviewsSection } from '@/components/reviews/profile-reviews-section'
import { useTranslation } from '@/lib/localization/i18n'
import type { ProfileSliceState } from '@/lib/profile/profile-progressive-state'

export type ProfileOverviewSection<T> = {
  query: Pick<ProfileQueryResult<T>, 'refetch'>
  state: ProfileSliceState<T>
}

export type ProfileOverviewProps<TReviews> = {
  isKnownEmpty: boolean
  movies: WatchedMovie[]
  sections: {
    movies: ProfileOverviewSection<WatchedMovie[]>
    reviews: ProfileOverviewSection<TReviews>
    series: ProfileOverviewSection<WatchedSeries[]>
    watchlists: ProfileOverviewSection<PublicWatchlistSummary[]>
  }
  series: WatchedSeries[]
  username?: string | null
  watchlists: PublicWatchlistSummary[]
}

export function ProfileOverview<TReviews>({
  isKnownEmpty,
  movies,
  sections,
  series,
  username,
  watchlists,
}: ProfileOverviewProps<TReviews>) {
  const { t } = useTranslation()

  if (isKnownEmpty) {
    return (
      <EmptyState
        body={t('emptyStates.profileBody')}
        illustrationLabel={t('emptyStates.profileIllustration')}
        title={t('emptyStates.profileTitle')}
        variant="profile"
      />
    )
  }

  return (
    <>
      <ProfileSectionState query={sections.movies.query} state={sections.movies.state}>
        {username ? (
          <ProfileMovieShelf
            items={movies}
            title={t('profile.watchedMovies')}
            username={username}
          />
        ) : null}
      </ProfileSectionState>

      <ProfileSectionState query={sections.series.query} state={sections.series.state}>
        {username ? <ProfileSeriesShelf items={series} username={username} /> : null}
      </ProfileSectionState>

      {username ? (
        <ProfileSectionState
          loadingFallback={<ProfileReviewsLoadingState />}
          query={sections.reviews.query}
          state={sections.reviews.state}
        >
          <ProfileReviewsSection username={username} />
        </ProfileSectionState>
      ) : null}

      <ProfileSectionState query={sections.watchlists.query} state={sections.watchlists.state}>
        <ProfileWatchlistShelf items={watchlists} />
      </ProfileSectionState>
    </>
  )
}

function ProfileReviewsLoadingState() {
  const { t } = useTranslation()

  return (
    <section aria-label={t('reviews.title')} className="mb-10">
      <h2 className="mb-4 text-xl font-semibold text-kino-text">{t('reviews.title')}</h2>

      <div className="flex gap-4.5">
        <div className="w-[calc(50%-9px)] shrink-0">
          <ProfileReviewSkeleton />
        </div>

        <div className="w-[calc(50%-9px)] shrink-0">
          <ProfileReviewSkeleton />
        </div>
      </div>
    </section>
  )
}
