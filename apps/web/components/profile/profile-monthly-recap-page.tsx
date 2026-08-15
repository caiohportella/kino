'use client'

import type { ProfileMonthlyRecap } from '@kino/core'
import { getTMDbImageUrl } from '@kino/core'
import { ArrowLeft, ArrowRight, Download, Loader2, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfileMonthlyRecap } from '@/hooks/use-profile-stats'
import { useTranslation } from '@/lib/i18n'
import { buildPreviousMonthComparisonRows } from '@/lib/monthly-comparison'
import { formatProfileMonth, profileStoryFilename, shiftMonth } from '@/lib/profile-recap'
import { formatWatchTimeCompact } from '@/lib/profile-stats'
import { profileStatsRecapImagePath, profileStatsRecapPath } from '@/lib/routes'
import { db } from '@/lib/services'
import { localizedTitleKey, useLocalizedTitles } from '@/lib/use-localized-titles'
import { HeroStat } from './hero-stat'
import { MonthlyWatchCalendar } from './monthly-watch-calendar'
import { PreviousMonthCard } from './previous-month-card'

type RecapMediaType = 'movie' | 'tv'

type LocalizableRecapTitle = {
  tmdbId: number
  title: string
  coverImage?: string | null
}

type PresentedRecapTitle = {
  title: string
  coverImage: string | null
  rating: number | null
}

type LocalizedTitleData = ReturnType<typeof useLocalizedTitles>['data']

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

  const localizedTitleRequests = useMemo(() => {
    if (!data) return []

    const requests: Array<{ tmdbId: number; type: RecapMediaType }> = [
      ...data.topRatedMovies.map((item) => ({
        tmdbId: item.tmdbId,
        type: 'movie' as const,
      })),
      ...data.topRatedSeries.map((item) => ({
        tmdbId: item.tmdbId,
        type: 'tv' as const,
      })),
      ...data.topTitles.map((item) => ({
        tmdbId: item.tmdbId,
        type: item.mediaType,
      })),
      ...data.mostWatchedSeries.map((item) => ({
        tmdbId: item.tmdbId,
        type: 'tv' as const,
      })),
      ...data.finishedSeries.map((item) => ({
        tmdbId: item.tmdbId,
        type: 'tv' as const,
      })),
      ...(data.highestRated
        ? [
            {
              tmdbId: data.highestRated.tmdbId,
              type: data.highestRated.mediaType,
            },
          ]
        : []),
      ...(data.lowestRated
        ? [
            {
              tmdbId: data.lowestRated.tmdbId,
              type: data.lowestRated.mediaType,
            },
          ]
        : []),
    ]

    return Array.from(
      new Map(requests.map((request) => [`${request.type}:${request.tmdbId}`, request])).values()
    )
  }, [data])

  const localizedTitles = useLocalizedTitles(localizedTitleRequests)

  const pagePending =
    recap.isPending ||
    Boolean(data && localizedTitleRequests.length > 0 && localizedTitles.isPending)

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

  const previousMonthRows = data
    ? buildPreviousMonthComparisonRows({
        comparison: data.previousMonthComparison,
        labels: {
          timeWatched: t('stats.timeWatched'),
          moviesWatched: t('stats.moviesWatched'),
          episodesWatched: t('stats.episodesWatched'),
          ratingsMade: t('stats.ratingsMade'),
        },
        formatTimeDelta: (minutes) => formatWatchTimeDelta(minutes, i18n.language),
      })
    : []

  const localizedHighestRated = data?.highestRated
    ? {
        ...presentRecapTitle(data.highestRated, data.highestRated.mediaType, localizedTitles.data),
        rating: data.highestRated.rating,
      }
    : null

  const localizedLowestRated = data?.lowestRated
    ? {
        ...presentRecapTitle(data.lowestRated, data.lowestRated.mediaType, localizedTitles.data),
        rating: data.lowestRated.rating,
      }
    : null

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
                disabled={pagePending}
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
                disabled={pagePending}
                onClick={() => router.push(profileStatsRecapPath(username, next.year, next.month))}
                size="icon"
                variant="secondary"
              >
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {downloadError ? (
        <p aria-live="polite" className="text-sm text-kino-muted">
          {downloadError}
        </p>
      ) : null}

      {pagePending ? (
        <div aria-busy="true" className="grid gap-5" role="status">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-60 w-full rounded-xl" />
            <Skeleton className="h-60 w-full rounded-xl" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
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
          <MonthOverview data={data} locale={i18n.language} />

          <MonthlyWatchCalendar dailyActivity={data.dailyActivity} month={month} year={year} />

          <TopTitlesCard
            data={data}
            locale={i18n.language}
            localizedTitles={localizedTitles.data}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <SeriesThisMonthCard
              data={data}
              locale={i18n.language}
              localizedTitles={localizedTitles.data}
            />

            <RatingSummaryCard
              averageRating={data.averageRating}
              highestRated={localizedHighestRated}
              locale={i18n.language}
              lowestRated={localizedLowestRated}
              ratingsMade={data.ratingsMade}
            />

            <TasteCard data={data} locale={i18n.language} />

            <PreviousMonthCard
              emptyLabel={t('stats.noPreviousMonthActivity')}
              hasActivity={hasPreviousActivity}
              rows={previousMonthRows}
              title={t('stats.comparedWithPreviousMonth')}
            />
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

              <Button disabled={downloading || pagePending} onClick={downloadStoryImage}>
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

function MonthOverview({ data, locale }: { data: ProfileMonthlyRecap; locale: string }) {
  const { t } = useTranslation()

  return (
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
          {formatWatchTimeCompact(data.timeWatchedMinutes, locale)}
        </div>
        <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-kino-muted">
          {t('stats.timeWatched')}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-4">
        <HeroStat label={t('stats.moviesWatched')} locale={locale} value={data.moviesWatched} />
        <HeroStat label={t('stats.episodesWatched')} locale={locale} value={data.episodesWatched} />
        <HeroStat label={t('stats.ratingsMade')} locale={locale} value={data.ratingsMade} />
        <HeroStat label={t('stats.activeDays')} locale={locale} value={data.activeDays} />
      </div>
    </section>
  )
}

function TopTitlesCard({
  data,
  locale,
  localizedTitles,
}: {
  data: ProfileMonthlyRecap
  locale: string
  localizedTitles: LocalizedTitleData
}) {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-sm font-bold text-kino-text">{t('stats.topTitles')}</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-6 px-6 pb-6 pt-4 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <SubsectionTitle>{t('stats.moviesWatched')}</SubsectionTitle>
          {data.topRatedMovies.length > 0 ? (
            data.topRatedMovies.map((item, index) => {
              const presentation = presentRecapTitle(item, 'movie', localizedTitles)
              return (
                <TopTitleRow
                  coverImage={presentation.coverImage}
                  index={index}
                  key={item.titleId}
                  locale={locale}
                  rating={item.rating}
                  subtitle={t('stats.moviesWatched')}
                  title={presentation.title}
                />
              )
            })
          ) : (
            <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
          )}
        </div>

        <div className="grid content-start gap-3 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <SubsectionTitle>{t('stats.episodesWatched')}</SubsectionTitle>
          {data.topRatedSeries.length > 0 ? (
            data.topRatedSeries.map((item, index) => {
              const presentation = presentRecapTitle(item, 'tv', localizedTitles)
              return (
                <TopTitleRow
                  coverImage={presentation.coverImage}
                  index={index}
                  key={item.titleId}
                  locale={locale}
                  rating={item.rating}
                  subtitle={t('stats.episodesWatched')}
                  title={presentation.title}
                />
              )
            })
          ) : (
            <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SeriesThisMonthCard({
  data,
  locale,
  localizedTitles,
}: {
  data: ProfileMonthlyRecap
  locale: string
  localizedTitles: LocalizedTitleData
}) {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-sm font-bold text-kino-text">{t('stats.tvThisMonth')}</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-1 px-6 pb-6 pt-4">
        {data.mostWatchedSeries.length > 0 ? (
          data.mostWatchedSeries.map((item) => {
            const percentage = item.percentageOfTvTime ?? 0
            const presentation = presentRecapTitle(item, 'tv', localizedTitles)

            return (
              <div
                className="flex items-center gap-3 border-b border-white/[0.07] py-3 last:border-b-0"
                key={item.titleId}
              >
                <PosterThumbnail image={presentation.coverImage} title={presentation.title} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-kino-text">
                    {presentation.title}
                  </div>

                  <div className="mt-1 text-xs text-kino-muted">
                    {new Intl.NumberFormat(locale).format(item.count)} {t('stats.episodesWatched')}
                    {' · '}
                    {formatWatchTimeCompact(item.watchTimeMinutes ?? 0, locale)}
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full bg-kino-accent"
                      style={{
                        width: `${Math.min(100, Math.max(percentage, 2))}%`,
                      }}
                    />
                  </div>
                </div>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-kino-accent">
                  {new Intl.NumberFormat(locale, {
                    maximumFractionDigits: 0,
                  }).format(percentage)}
                  %
                </span>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
        )}
      </CardContent>
    </Card>
  )
}

function RatingSummaryCard({
  averageRating,
  highestRated,
  locale,
  lowestRated,
  ratingsMade,
}: {
  averageRating: number | null
  highestRated: PresentedRecapTitle | null
  locale: string
  lowestRated: PresentedRecapTitle | null
  ratingsMade: number
}) {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-sm font-bold text-kino-text">
          {t('stats.highsAndLows')}
        </CardTitle>
        <p className="text-xs text-kino-muted">
          {new Intl.NumberFormat(locale).format(ratingsMade)} {t('stats.ratingsMade')}
        </p>
      </CardHeader>

      <CardContent className="grid gap-4 px-6 pb-6 pt-4">
        {averageRating != null ? (
          <div className="grid w-fit gap-0.5">
            <RatingValue
              className="text-xl font-bold text-kino-accent"
              locale={locale}
              rating={averageRating}
              starSize={15}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-kino-muted">
              {t('stats.averageRating')}
            </span>
          </div>
        ) : null}

        <div className="grid">
          <RatedTitleRow
            emptyLabel={t('stats.noActivity')}
            item={highestRated}
            label={t('stats.highestRated')}
            locale={locale}
          />
          <RatedTitleRow
            emptyLabel={t('stats.noActivity')}
            item={lowestRated}
            label={t('stats.lowestRated')}
            locale={locale}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function RatedTitleRow({
  emptyLabel,
  item,
  label,
  locale,
}: {
  emptyLabel: string
  item: PresentedRecapTitle | null
  label: string
  locale: string
}) {
  if (!item) {
    return (
      <div className="border-b border-white/[0.07] py-3 last:border-b-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-kino-muted">
          {label}
        </div>
        <div className="mt-1 text-sm text-kino-muted">{emptyLabel}</div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 border-b border-white/[0.07] py-3 last:border-b-0">
      <PosterThumbnail image={item.coverImage} title={item.title} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-kino-muted">
          {label}
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-kino-text">{item.title}</div>
      </div>
      {item.rating != null ? (
        <RatingValue
          className="shrink-0 text-sm font-semibold text-kino-accent"
          locale={locale}
          rating={item.rating}
          starSize={13}
        />
      ) : null}
    </div>
  )
}

function TasteCard({ data, locale }: { data: ProfileMonthlyRecap; locale: string }) {
  const { t } = useTranslation()

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-sm font-bold text-kino-text">{t('stats.yourGenres')}</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4 px-6 pb-6 pt-4">
        {data.topGenres.length > 0 ? (
          data.topGenres.map((item) => {
            const genreLabel = t(`genres.${item.genreId}`, {
              defaultValue: item.name,
            })

            return (
              <div className="grid gap-1.5" key={item.genreId}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-kino-text">{genreLabel}</span>
                  <span className="text-xs tabular-nums text-kino-muted">
                    {new Intl.NumberFormat(locale, {
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
            )
          })
        ) : (
          <p className="text-sm text-kino-muted">{t('stats.noActivity')}</p>
        )}
      </CardContent>
    </Card>
  )
}

function SubsectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-kino-muted">
      {children}
    </div>
  )
}

function TopTitleRow({
  coverImage,
  index,
  locale,
  rating,
  subtitle,
  title,
}: {
  coverImage: string | null
  index: number
  locale: string
  rating: number | null
  subtitle: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-4 shrink-0 text-xs font-semibold text-kino-muted/60">{index + 1}</div>
      <PosterThumbnail image={coverImage} title={title} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-kino-text">{title}</div>
        <div className="text-xs text-kino-muted">{subtitle}</div>
      </div>
      {rating != null ? (
        <RatingValue
          className="shrink-0 text-sm font-semibold text-kino-accent"
          locale={locale}
          rating={rating}
          starSize={13}
        />
      ) : (
        <span className="shrink-0 text-sm text-kino-muted">—</span>
      )}
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

function RatingValue({
  className,
  locale,
  rating,
  starSize = 13,
}: {
  className?: string
  locale: string
  rating: number
  starSize?: number
}) {
  return (
    <span className={`inline-flex items-center gap-1 leading-none tabular-nums ${className ?? ''}`}>
      <span>
        {new Intl.NumberFormat(locale, {
          maximumFractionDigits: 1,
        }).format(rating)}
      </span>
      <Star aria-hidden="true" className="shrink-0 fill-current" size={starSize} strokeWidth={0} />
    </span>
  )
}

function presentRecapTitle<T extends LocalizableRecapTitle>(
  item: T,
  type: RecapMediaType,
  localizedTitles: LocalizedTitleData
) {
  const localized =
    localizedTitles?.[
      localizedTitleKey({
        tmdbId: item.tmdbId,
        type,
      })
    ]

  return {
    title: localized?.title ?? item.title,
    coverImage: localized?.posterPath ?? item.coverImage ?? null,
  }
}

function formatWatchTimeDelta(minutes: number, locale: string) {
  const sign = minutes > 0 ? '+' : minutes < 0 ? '−' : ''
  return `${sign}${formatWatchTimeCompact(Math.abs(minutes), locale)}`
}
