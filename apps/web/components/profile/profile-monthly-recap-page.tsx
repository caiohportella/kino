'use client'

import type { ProfileMonthlyRecap } from '@kino/core'
import { getTMDbImageUrl } from '@kino/core'
import { ArrowLeft, ArrowRight, Download, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfileMonthlyRecap } from '@/hooks/use-profile-stats'
import { useTranslation } from '@/lib/i18n'
import { formatProfileMonth, profileStoryFilename, shiftMonth } from '@/lib/profile-recap'
import { formatWatchTimeCompact } from '@/lib/profile-stats'
import { profileStatsRecapImagePath, profileStatsRecapPath } from '@/lib/routes'
import { db } from '@/lib/services'
import { HeroStat } from './hero-stat'
import { HighsAndLowsCard } from './highs-and-lows-card'
import { MonthlyWatchCalendar } from './monthly-watch-calendar'
import { PreviousMonthCard, type PreviousMonthComparisonRow } from './previous-month-card'

export function ProfileMonthlyRecapPage({
  profileId,
  username,
  displayName,
  month,
  year,
}: {
  profileId: string
  username: string
  displayName: string
  month: number
  year: number
}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()

  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const recap = useProfileMonthlyRecap({
    profileId,
    service: db,
    visibilityScope: { kind: 'public' },
    year,
    month,
  })

  const currentLabel = formatProfileMonth(year, month, i18n.language)
  const previous = shiftMonth(year, month, -1)
  const next = shiftMonth(year, month, 1)

  const data = recap.data

  const previousTotals = data
    ? {
        movies: data.moviesWatched - data.previousMonthComparison.moviesDelta,
        episodes: data.episodesWatched - data.previousMonthComparison.episodesDelta,
        ratings: data.ratingsMade - data.previousMonthComparison.ratingsDelta,
        time: data.timeWatchedMinutes - data.previousMonthComparison.timeWatchedMinutesDelta,
      }
    : null

  const hasPreviousActivity = Boolean(
    previousTotals &&
      (previousTotals.movies > 0 ||
        previousTotals.episodes > 0 ||
        previousTotals.ratings > 0 ||
        previousTotals.time > 0)
  )

  const previousMonthRows: PreviousMonthComparisonRow[] = data
    ? [
        {
          id: 'time',
          label: t('stats.timeWatched'),
          value: formatWatchTimeDelta(
            data.previousMonthComparison.timeWatchedMinutesDelta,
            i18n.language
          ),
        },
        {
          id: 'movies',
          label: t('stats.moviesWatched'),
          value: formatDelta(data.previousMonthComparison.moviesDelta),
        },
        {
          id: 'episodes',
          label: t('stats.episodesWatched'),
          value: formatDelta(data.previousMonthComparison.episodesDelta),
        },
        {
          id: 'ratings',
          label: t('stats.ratingsMade'),
          value: formatDelta(data.previousMonthComparison.ratingsDelta),
        },
      ]
    : []

  async function downloadStoryImage() {
    setDownloading(true)
    setDownloadError(null)

    try {
      const response = await fetch(
        profileStatsRecapImagePath(username, year, month, {
          displayName,
          profileId,
        })
      )

      if (!response.ok) {
        throw new Error(t('stats.imageGenerationFailed'))
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = profileStoryFilename(username, year, month)
      link.click()

      URL.revokeObjectURL(url)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : t('stats.imageGenerationFailed'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="content-frame mx-auto grid w-full max-w-280 gap-5">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-kino-muted">
            {t('stats.monthlyRecap')}
          </p>

          <div className="flex items-center gap-3">
            <h1 className="text-[30px] font-bold leading-none tracking-tight text-kino-text">
              {currentLabel}
            </h1>

            <div className="flex gap-1.5">
              <Button
                aria-label={t('common.previous')}
                className="size-8"
                disabled={recap.isPending}
                onClick={() =>
                  router.push(profileStatsRecapPath(username, previous.year, previous.month))
                }
                size="icon"
                variant="secondary"
              >
                <ArrowLeft size={15} />
              </Button>

              <Button
                aria-label={t('common.next')}
                className="size-8"
                disabled={recap.isPending}
                onClick={() => router.push(profileStatsRecapPath(username, next.year, next.month))}
                size="icon"
                variant="secondary"
              >
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>

          <p className="mt-2 max-w-xl text-sm leading-5 text-kino-muted">
            {data ? (
              <>
                {displayName ? `${displayName} · ` : ''}

                {t('stats.recapIntro', {
                  movies: data.moviesWatched,
                  episodes: data.episodesWatched,
                  days: data.activeDays,
                })}
              </>
            ) : (
              displayName
            )}
          </p>
        </div>
      </header>
      
      {recap.isPending ? (
        <div aria-busy="true" className="grid gap-5" role="status">
          <span className="sr-only">{t('common.loading')}</span>

          <Skeleton className="h-52 w-full rounded-xl" />

          <Skeleton className="h-80 w-full rounded-xl" />

          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-60 w-full rounded-xl" />
            <Skeleton className="h-60 w-full rounded-xl" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        </div>
      ) : recap.isError ? (
        <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
          <CardContent className="grid gap-3 p-5">
            <p className="text-sm text-kino-muted">{t('common.tryAgain')}</p>

            <Button onClick={() => void recap.refetch()} variant="secondary">
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-5">
          <section className="rounded-[14px] border border-white/10 bg-kino-surface px-6 py-7 md:px-8">
            <p className="max-w-2xl text-xl font-semibold leading-snug text-kino-text md:text-[21px]">
              {t('stats.recapSentence', {
                movies: data.moviesWatched,
                episodes: data.episodesWatched,
                days: data.activeDays,
              })}
            </p>

            <div className="mt-4">
              <div className="text-[42px] font-bold leading-none tracking-tight text-kino-accent">
                {formatWatchTimeCompact(data.timeWatchedMinutes, i18n.language)}
              </div>

              <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-kino-muted">
                {t('stats.timeWatched')}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-4">
              <HeroStat
                label={t('stats.moviesWatched')}
                locale={i18n.language}
                value={data.moviesWatched}
              />

              <HeroStat
                label={t('stats.episodesWatched')}
                locale={i18n.language}
                value={data.episodesWatched}
              />

              <HeroStat
                label={t('stats.ratingsMade')}
                locale={i18n.language}
                value={data.ratingsMade}
              />

              <HeroStat
                label={t('stats.activeDays')}
                locale={i18n.language}
                value={data.activeDays}
              />
            </div>
          </section>

          <MonthlyWatchCalendar dailyActivity={data.dailyActivity} month={month} year={year} />

          <div className="grid gap-5 lg:grid-cols-2">
            <HighsAndLowsCard
              description={t('stats.highsAndLowsDescription')}
              emptyLabel={t('stats.noActivity')}
              highestRated={data.highestRated}
              highestRatedLabel={t('stats.highestRated')}
              lowestRated={data.lowestRated}
              lowestRatedLabel={t('stats.lowestRated')}
              movieLabel={t('common.movie')}
              seriesLabel={t('common.series')}
              title={t('stats.highsAndLows')}
            />

            <PreviousMonthCard
              emptyLabel={t('stats.noPreviousMonthActivity')}
              hasActivity={hasPreviousActivity}
              rows={previousMonthRows}
              title={t('stats.comparedWithPreviousMonth')}
            />
          </div>

          <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
            <CardHeader className="gap-1 px-6 pt-6">
              <CardTitle className="text-sm font-bold text-kino-text">
                {t('stats.topTitles')}
              </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-6 px-6 pb-6 pt-4 lg:grid-cols-2">
              <div className="grid content-start gap-3">
                <SubsectionTitle>{t('stats.moviesWatched')}</SubsectionTitle>

                {data.topRatedMovies.length > 0 ? (
                  data.topRatedMovies.map((item, index) => (
                    <TopTitleRow
                      index={index}
                      item={item}
                      key={item.titleId}
                      subtitle={t('stats.moviesWatched')}
                    />
                  ))
                ) : (
                  <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
                )}
              </div>

              <div className="grid content-start gap-3 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <SubsectionTitle>{t('stats.episodesWatched')}</SubsectionTitle>

                {data.topRatedSeries.length > 0 ? (
                  data.topRatedSeries.map((item, index) => (
                    <TopTitleRow
                      index={index}
                      item={item}
                      key={item.titleId}
                      subtitle={t('stats.episodesWatched')}
                    />
                  ))
                ) : (
                  <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
              <CardHeader className="gap-1 px-6 pt-6">
                <CardTitle className="text-sm font-bold text-kino-text">
                  {t('stats.yourGenres')}
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-4 px-6 pb-6 pt-4">
                {data.topGenres.length > 0 ? (
                  data.topGenres.map((item) => (
                    <div className="grid gap-1.5" key={item.genreId}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-kino-text">{item.name}</span>

                        <span className="text-xs text-kino-muted">
                          {new Intl.NumberFormat(i18n.language, {
                            maximumFractionDigits: 0,
                          }).format(item.percentage)}
                          %
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                        <div
                          className="h-full rounded-full bg-(--chart-1)"
                          style={{
                            width: `${Math.min(100, Math.max(item.percentage, 2))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
              <CardHeader className="gap-1 px-6 pt-6">
                <CardTitle className="text-sm font-bold text-kino-text">
                  {t('stats.tvThisMonth')}
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3 px-6 pb-6 pt-4">
                {data.mostWatchedSeries.length > 0 ? (
                  data.mostWatchedSeries.map((item) => (
                    <div
                      className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-2 last:border-b-0"
                      key={item.titleId}
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-kino-text">
                        {item.title}
                      </span>

                      <span className="shrink-0 text-sm font-semibold text-kino-accent">
                        {new Intl.NumberFormat(i18n.language).format(item.count)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
              <CardHeader className="gap-1 px-6 pt-6">
                <CardTitle className="text-sm font-bold text-kino-text">
                  {t('stats.mostWatchedStudio')}
                </CardTitle>
              </CardHeader>

              <CardContent className="px-6 pb-6 pt-4">
                {data.mostWatchedStudio ? (
                  <div className="flex items-center gap-4">
                    <StudioLogo studio={data.mostWatchedStudio} />

                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-kino-text">
                        {data.mostWatchedStudio.name}
                      </div>

                      <div className="mt-1 text-xs text-kino-muted">
                        {new Intl.NumberFormat(i18n.language).format(data.mostWatchedStudio.count)}{' '}
                        {t('stats.moviesWatched')}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
            <CardContent className="grid gap-5 p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <div className="flex h-31 w-17.5 shrink-0 flex-col justify-between rounded-[10px] border border-white/10 bg-[radial-gradient(circle_at_50%_10%,rgba(29,185,84,0.22),transparent_45%),linear-gradient(180deg,#181a19,#111312)] px-2 py-2.5">
                <span className="text-[7px] font-semibold uppercase tracking-[0.08em] text-white/40">
                  {currentLabel}
                </span>

                <span className="text-[11px] font-extrabold text-kino-accent">
                  {formatWatchTimeCompact(data.timeWatchedMinutes, i18n.language)}
                </span>
              </div>

              <div className="min-w-0">
                <h2 className="text-sm font-bold text-kino-text">{t('stats.shareStoryImage')}</h2>

                <p className="mt-1 max-w-xl text-sm leading-5 text-kino-muted">
                  {t('stats.storyImageDescription')}
                </p>
              </div>

              <Button disabled={downloading || recap.isPending} onClick={downloadStoryImage}>
                {downloading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Download size={16} />
                )}

                {downloading ? t('stats.generatingImage') : t('stats.downloadStoryImage')}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

type RecapItem =
  | ProfileMonthlyRecap['topRatedMovies'][number]
  | ProfileMonthlyRecap['topRatedSeries'][number]

function formatDelta(value: number) {
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}`
}

function SubsectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-kino-muted">
      {children}
    </div>
  )
}

function TopTitleRow({
  index,
  item,
  subtitle,
}: {
  index: number
  item: RecapItem
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-4 shrink-0 text-xs font-semibold text-kino-muted/60">{index + 1}</div>

      <PosterThumbnail image={item.coverImage ?? null} title={item.title} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-kino-text">{item.title}</div>

        <div className="text-xs text-kino-muted">{subtitle}</div>
      </div>

      <div className="shrink-0 text-sm font-semibold text-kino-accent">
        {item.rating != null ? formatRating(item.rating) : '—'}
      </div>
    </div>
  )
}

function PosterThumbnail({ title, image }: { title: string; image: string | null }) {
  const src = getTMDbImageUrl(image, 'w300')

  return (
    <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/4">
      {src ? (
        <img alt={title} className="h-full w-full object-cover" src={src} />
      ) : (
        <div className="flex h-full w-full items-end bg-[linear-gradient(155deg,#1e1f1d_0%,#111312_100%)] p-1">
          <span className="line-clamp-3 text-[8px] font-semibold leading-tight text-white/70">
            {title}
          </span>
        </div>
      )}
    </div>
  )
}

function StudioLogo({ studio }: { studio: NonNullable<ProfileMonthlyRecap['mostWatchedStudio']> }) {
  const logoUrl = getTMDbImageUrl(studio.logoPath, 'w300')

  return (
    <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white p-2">
      {logoUrl ? (
        <img alt={`${studio.name} logo`} className="h-full w-full object-contain" src={logoUrl} />
      ) : (
        <div className="text-xs font-bold uppercase tracking-widest text-black/60">
          {studio.name.slice(0, 2)}
        </div>
      )}
    </div>
  )
}

function formatRating(rating: number) {
  const whole = Math.floor(rating)

  const hasHalf = Math.abs(rating - whole) >= 0.25 && Math.abs(rating - whole) < 0.75

  return `${whole}${hasHalf ? '.5' : ''}★`
}

function formatWatchTimeDelta(minutes: number, locale: string) {
  const sign = minutes > 0 ? '+' : minutes < 0 ? '−' : ''

  return `${sign}${formatWatchTimeCompact(Math.abs(minutes), locale)}`
}
