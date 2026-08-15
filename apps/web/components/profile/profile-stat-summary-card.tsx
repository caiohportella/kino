'use client'

import type { ProfileLifetimeStats, ProfileMediaStats } from '@kino/core'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'
import { formatWatchTimeCompact } from '@/lib/profile-stats'

export function ProfileStatSummaryCard({
  stats,
  mediaStats,
  joinedMonth,
  joinedYear,
  error = false,
  loading = false,
  onRetry,
  href,
  variant = 'compact',
}: {
  stats?: ProfileLifetimeStats | null
  mediaStats?: ProfileMediaStats | null
  joinedMonth?: string | null
  joinedYear?: number | null
  error?: boolean
  loading?: boolean
  onRetry?: () => void
  href?: string
  variant?: 'compact' | 'lifetime'
}) {
  const { t, i18n } = useTranslation()

  if (loading) {
    return <ProfileStatsHeroSkeleton href={Boolean(href)} />
  }

  if (error) {
    return (
      <Card className="gap-0 overflow-hidden p-0">
        <CardContent className="p-5 sm:p-6">
          <p className="text-sm text-kino-muted">{t('common.tryAgain')}</p>

          {onRetry ? (
            <Button className="mt-4" onClick={onRetry} size="sm" variant="outline">
              {t('common.retry')}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  const moviesWatched = stats?.moviesWatched ?? 0
  const seriesWatched = mediaStats?.seriesWatched ?? null
  const episodesWatched = stats?.episodesWatched ?? 0
  const ratingsMade = stats?.ratingsMade ?? 0
  const timeWatchedMinutes = stats?.timeWatchedMinutes ?? 0

  const numberFormatter = new Intl.NumberFormat(i18n.language)

  if (variant === 'lifetime') {
    return (
      <LifetimeSummaryLayout
        episodesWatched={episodesWatched}
        joinedMonth={joinedMonth}
        joinedYear={joinedYear}
        moviesWatched={moviesWatched}
        ratingsMade={ratingsMade}
        seriesWatched={seriesWatched}
        timeWatchedMinutes={timeWatchedMinutes}
      />
    )
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardContent className="p-5 sm:p-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-kino-muted">
          {t('stats.time')}
        </div>

        <div className="mt-2 text-[38px] font-extrabold leading-none tracking-tight text-kino-text">
          {formatWatchTimeCompact(timeWatchedMinutes, i18n.language)}
        </div>

        {joinedMonth && joinedYear ? (
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-kino-muted">
            {t('stats.sinceJoining', {
              month: joinedMonth,
              year: joinedYear,
            })}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/7 bg-white/35">
          <HeroMetric
            className="border-b border-r border-white/7"
            label={t('stats.moviesWatched')}
            value={numberFormatter.format(moviesWatched)}
          />

          <HeroMetric
            className="border-b border-white/7"
            label={t('stats.seriesWatched')}
            value={seriesWatched == null ? '\u2014' : numberFormatter.format(seriesWatched)}
          />

          <HeroMetric
            className="border-r border-white/7"
            label={t('stats.episodesWatched')}
            value={numberFormatter.format(episodesWatched)}
          />

          <HeroMetric label={t('stats.ratingsMade')} value={numberFormatter.format(ratingsMade)} />
        </div>
      </CardContent>

      {href ? (
        <Link
          className="
            group flex items-center justify-between
            border-t border-white/7
            px-5 py-4
            text-[13.5px] font-semibold text-kino-text
            transition-colors
            hover:bg-white/[0.035]
            focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/20
            sm:px-6
          "
          href={href}
        >
          <span>{t('stats.viewStatistics')}</span>

          <span className="flex size-6 items-center justify-center rounded-full">
            <ArrowRight
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-0.5"
              size={16}
            />
          </span>
        </Link>
      ) : null}
    </Card>
  )
}

function LifetimeSummaryLayout({
  moviesWatched,
  seriesWatched,
  episodesWatched,
  ratingsMade,
  timeWatchedMinutes,
  joinedMonth,
  joinedYear,
}: {
  moviesWatched: number
  seriesWatched: number | null
  episodesWatched: number
  ratingsMade: number
  timeWatchedMinutes: number
  joinedMonth?: string | null
  joinedYear?: number | null
}) {
  const { t, i18n } = useTranslation()
  const numberFormatter = new Intl.NumberFormat(i18n.language)

  return (
    <Card className="gap-0 p-0">
      <CardContent className="p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-kino-muted">
              {t('stats.totalTimeWatched')}
            </p>

            <div className="mt-2 text-[42px] font-extrabold leading-none tracking-[-0.035em] text-kino-text sm:text-[48px]">
              {formatWatchTimeCompact(timeWatchedMinutes, i18n.language)}
            </div>

            {joinedMonth && joinedYear ? (
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-kino-muted">
                {t('stats.sinceJoining', {
                  month: joinedMonth,
                  year: joinedYear,
                })}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/6 bg-black/10">
            <HeroMetric
              className="border-b border-r border-white/6"
              label={t('stats.moviesWatched')}
              value={numberFormatter.format(moviesWatched)}
            />

            <HeroMetric
              className="border-b border-white/6"
              label={t('stats.seriesWatched')}
              value={seriesWatched == null ? '—' : numberFormatter.format(seriesWatched)}
            />

            <HeroMetric
              className="border-r border-white/6"
              label={t('stats.episodesWatched')}
              value={numberFormatter.format(episodesWatched)}
            />

            <HeroMetric
              label={t('stats.ratingsMade')}
              value={numberFormatter.format(ratingsMade)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function HeroMetric({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`min-w-0 px-4 py-3.5 ${className}`}>
      <div className="text-xl font-extrabold leading-none tracking-tight text-kino-text">
        {value}
      </div>

      <div className="mt-1.5 text-[9px] font-bold uppercase leading-[1.3] tracking-[0.04em] text-kino-muted">
        {label}
      </div>
    </div>
  )
}

function ProfileStatsHeroSkeleton({ href }: { href: boolean }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardContent className="p-5 sm:p-6">
        <Skeleton className="h-3 w-36" />

        <Skeleton className="mt-3 h-10 w-32" />

        <div className="mt-3 grid gap-2">
          <Skeleton className="h-3 w-full max-w-72" />
          <Skeleton className="h-3 w-48" />
        </div>

        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/7">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className={[
                'grid gap-2 px-4 py-4',
                index === 0 ? 'border-b border-r border-white/8' : '',
                index === 1 ? 'border-b border-white/8' : '',
                index === 2 ? 'border-r border-white/8' : '',
              ].join(' ')}
              key={index}
            >
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-3 w-20 max-w-full" />
            </div>
          ))}
        </div>
      </CardContent>

      {href ? (
        <div className="border-t border-white/8 px-5 py-4 sm:px-6">
          <Skeleton className="h-4 w-28" />
        </div>
      ) : null}
    </Card>
  )
}
