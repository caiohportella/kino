'use client'

import type { ProfileRatingBucket, ProfileRatingStats } from '@kino/core'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'
import { getLocalizedGenreName } from '@/lib/localized-genre'

function ratingLabel(rating: number) {
  const whole = Math.floor(rating)
  const half = rating % 1 !== 0

  return `${whole}${half ? '½' : ''}`
}

export function ProfileRatingStatsCard({
  stats,
  error = false,
  loading = false,
  onRetry,
}: {
  stats?: ProfileRatingStats | null
  error?: boolean
  loading?: boolean
  onRetry?: () => void
}) {
  const { t, i18n } = useTranslation()

  const ratingFormatter = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  })
  const percentageFormatter = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
    style: 'percent',
  })
  const notAvailableLabel = t('common.notAvailable')
  const chartConfig = {
    count: {
      label: t('stats.ratings'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  const average = stats?.averageRating

  const data = (stats?.distribution ?? [])
    .map((item) => ({
      ...item,
      label: ratingLabel(item.rating),
    }))
    .sort((left, right) => right.rating - left.rating)

  const formatPercentage = (value: number) => percentageFormatter.format(value / 100)

  const renderRatedInsight = (label: string, average: number, titleCount: number) => (
    <div className="grid gap-0.5">
      <span className="truncate text-base font-semibold text-kino-text">{label}</span>

      <span className="text-xs text-kino-muted">
        {t('stats.averageAcrossTitles', {
          rating: ratingFormatter.format(average),
          count: titleCount,
        })}
      </span>
    </div>
  )

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="gap-1 px-5 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>{t('stats.ratings')}</CardTitle>
            <CardDescription>{t('stats.ratingsDescription')}</CardDescription>
          </div>

          {!loading && !error && stats ? (
            <span className="whitespace-nowrap text-xs text-kino-muted">
              {t('stats.ratingsCount', { count: stats.totalRatings })}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        {loading ? (
          <RatingStatsSkeleton />
        ) : error ? (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <p className="text-sm text-kino-muted">{t('common.tryAgain')}</p>

              {onRetry ? (
                <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
                  {t('common.retry')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : stats ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-kino-text">
                  {average == null ? notAvailableLabel : ratingFormatter.format(average)}
                </span>

                {average != null ? <span className="text-sm text-kino-muted">/ 5</span> : null}
              </div>

              <div className="mt-6">
                <RatingInsight
                  label={t('stats.averageRatingForSeries')}
                  value={
                    <div className="grid gap-0.5">
                      <span className="text-base font-semibold text-kino-text">
                        {stats.seriesAverageRating == null
                          ? notAvailableLabel
                          : ratingFormatter.format(stats.seriesAverageRating)}
                      </span>
                      <span className="text-xs text-kino-muted">
                        {stats.seriesAverageRating != null && stats.movieAverageRating != null
                          ? t('stats.vsRatingForMovies', {
                              rating: ratingFormatter.format(stats.movieAverageRating),
                            })
                          : t('stats.noRatings')}
                      </span>
                    </div>
                  }
                />

                <RatingInsight
                  label={t('stats.mostRatedGenre')}
                  value={
                    stats.mostRatedGenre ? (
                      <div className="grid gap-0.5">
                        <span className="truncate text-base font-semibold text-kino-text">
                          {getLocalizedGenreName(stats.mostRatedGenre, t)}
                        </span>

                        <span className="text-xs text-kino-muted">
                          {t('stats.ratedTitlesCount', {
                            count: stats.mostRatedGenre.titleCount,
                          })}
                        </span>
                      </div>
                    ) : (
                      notAvailableLabel
                    )
                  }
                />

                <RatingInsight
                  label={t('stats.highestRatedGenre')}
                  value={
                    stats.highestRatedGenre
                      ? renderRatedInsight(
                          getLocalizedGenreName(stats.highestRatedGenre, t),
                          stats.highestRatedGenre.average,
                          stats.highestRatedGenre.titleCount
                        )
                      : notAvailableLabel
                  }
                />

                <RatingInsight
                  label={t('stats.highestRatedDecade')}
                  value={
                    stats.highestRatedDecade
                      ? renderRatedInsight(
                          `${stats.highestRatedDecade.startYear}s`,
                          stats.highestRatedDecade.average,
                          stats.highestRatedDecade.titleCount
                        )
                      : notAvailableLabel
                  }
                />

                <RatingInsight
                  label={t('stats.highestRatedStudio')}
                  value={
                    stats.highestRatedStudio
                      ? renderRatedInsight(
                          stats.highestRatedStudio.name,
                          stats.highestRatedStudio.average,
                          stats.highestRatedStudio.titleCount
                        )
                      : notAvailableLabel
                  }
                />

                <RatingInsight
                  label={t('stats.highestRatedActor')}
                  value={
                    stats.highestRatedActor
                      ? renderRatedInsight(
                          stats.highestRatedActor.name,
                          stats.highestRatedActor.average,
                          stats.highestRatedActor.titleCount
                        )
                      : notAvailableLabel
                  }
                />

                <RatingInsight
                  label={t('stats.highestRatedActress')}
                  value={
                    stats.highestRatedActress
                      ? renderRatedInsight(
                          stats.highestRatedActress.name,
                          stats.highestRatedActress.average,
                          stats.highestRatedActress.titleCount
                        )
                      : notAvailableLabel
                  }
                />
              </div>
            </div>

            <div className="min-w-0 border-t border-white/10 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              {data.length > 0 ? (
                <ChartContainer className="h-72 w-full lg:h-full" config={chartConfig}>
                  <BarChart
                    accessibilityLayer
                    data={data}
                    layout="vertical"
                    margin={{
                      top: 0,
                      right: 38,
                      bottom: 0,
                      left: 0,
                    }}
                  >
                    <CartesianGrid horizontal={false} strokeOpacity={0.06} />

                    <XAxis hide type="number" />

                    <YAxis
                      axisLine={false}
                      dataKey="label"
                      tickLine={false}
                      tickMargin={8}
                      type="category"
                      width={38}
                    />

                    <ChartTooltip
                      cursor={false}
                      content={
                        <RatingDistributionTooltip
                          formatPercentage={formatPercentage}
                          percentageLabel={t('stats.percentage')}
                          ratingsCountLabel={(count) => t('stats.ratingsCount', { count })}
                        />
                      }
                    />

                    <Bar dataKey="count" fill="var(--color-count)" radius={[0, 5, 5, 0]}>
                      <LabelList
                        className="fill-kino-muted"
                        dataKey="percentage"
                        fontSize={11}
                        formatter={(value) => formatPercentage(Number(value ?? 0))}
                        position="right"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-kino-muted">{t('stats.noRatings')}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-kino-muted">{t('stats.noRatings')}</p>
        )}
      </CardContent>
    </Card>
  )
}

function RatingInsight({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-sm text-kino-muted">{label}</span>

      <div className="max-w-[60%] text-right text-sm font-medium text-kino-text">{value}</div>
    </div>
  )
}

function RatingDistributionTooltip({
  active,
  payload,
  ratingsCountLabel,
  percentageLabel,
  formatPercentage,
}: {
  active?: boolean
  payload?: Array<{ payload?: ProfileRatingBucket & { label: string } }>
  ratingsCountLabel: (count: number) => string
  percentageLabel: string
  formatPercentage: (value: number) => string
}) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null

  return (
    <div className="grid min-w-40 gap-1.5 rounded-md border border-white/10 bg-kino-panel px-3 py-2 text-sm shadow-soft">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-kino-muted">
        {item.label}
      </div>
      <div className="grid gap-1 text-xs text-kino-muted">
        <div className="font-medium text-kino-text">{ratingsCountLabel(item.count)}</div>
        <div className="flex items-center justify-between gap-4">
          <span>{percentageLabel}</span>
          <span className="font-semibold text-kino-text">{formatPercentage(item.percentage)}</span>
        </div>
      </div>
    </div>
  )
}

function RatingStatsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
      <div>
        <div className="flex items-end gap-3">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="mt-6">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              className="flex items-start justify-between gap-6 border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0"
              key={index}
            >
              <Skeleton className="h-3 w-32" />

              <div className="grid justify-items-end gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 border-t border-white/10 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        {Array.from({ length: 10 }, (_, index) => (
          <div className="flex items-center gap-3" key={index}>
            <Skeleton className="h-3 w-5" />
            <Skeleton
              className="h-4"
              style={{
                width: `${35 + ((index * 13) % 60)}%`,
              }}
            />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  )
}
