'use client'

import { Film, Star, Tv, UserRoundCheck, UsersRound } from 'lucide-react'
import { HeroStat } from '@/components/profile/hero-stat'
import { useTranslation } from '@/lib/localization/i18n'

export type ProfileHeroStatsProps = {
  averageMovieRating: number | null
  averageSeriesRating: number | null
  followers: number
  following: number
  locale: string
  moviesWatched: number
  onFollowersClick: () => void
  onFollowingClick: () => void
  onMovieRatingClick?: () => void
  onSeriesRatingClick?: () => void
  seriesWatched: number
}

export function ProfileHeroStats({
  averageMovieRating,
  averageSeriesRating,
  followers,
  following,
  locale,
  moviesWatched,
  onFollowersClick,
  onFollowingClick,
  onMovieRatingClick,
  onSeriesRatingClick,
  seriesWatched,
}: ProfileHeroStatsProps) {
  const { t } = useTranslation()

  return (
    <div
      className="
        mb-8
        grid grid-cols-2
        gap-3

        sm:grid-cols-3
        lg:grid-cols-6
      "
    >
      <HeroStat
        icon={Film}
        label={t('profile.watchedMovies')}
        locale={locale}
        value={moviesWatched}
      />

      <HeroStat
        icon={Tv}
        label={t('profile.watchedSeries')}
        locale={locale}
        value={seriesWatched}
      />

      <HeroStat
        icon={Star}
        label={t('profile.avgMovieRating')}
        onClick={onMovieRatingClick}
        value={averageMovieRating == null ? '—' : averageMovieRating.toFixed(1)}
      />

      <HeroStat
        icon={Star}
        label={t('profile.avgSeriesRating')}
        onClick={onSeriesRatingClick}
        value={averageSeriesRating == null ? '—' : averageSeriesRating.toFixed(1)}
      />

      <HeroStat
        icon={UsersRound}
        label={t('profile.followers')}
        locale={locale}
        onClick={onFollowersClick}
        value={followers}
      />

      <HeroStat
        icon={UserRoundCheck}
        label={t('profile.following')}
        locale={locale}
        onClick={onFollowingClick}
        value={following}
      />
    </div>
  )
}
