'use client'

import type { ProfileGenreStat, ProfileMediaSplit, ProfileViewingBreakdownStats } from '@kino/core'
import { ProfileCompositionBarChart } from '@/components/profile/profile-composition-bar-chart'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'
import { getLocalizedGenreName } from '@/lib/localized-genre'
import { formatWatchTimeCompact } from '@/lib/profile-stats'

type DecadeStat = {
  label: string
  count: number
  percentage: number
}

export function ProfileWatchingHabitsCard({
  viewingStats,
  genreStats,
  decades,
  viewingError = false,
  genreError = false,
  viewingLoading = false,
  genreLoading = false,
  onRetryViewing,
  onRetryGenres,
}: {
  viewingStats?: ProfileViewingBreakdownStats | null
  genreStats?: ProfileGenreStat[] | null
  decades: DecadeStat[]
  viewingError?: boolean
  genreError?: boolean
  viewingLoading?: boolean
  genreLoading?: boolean
  onRetryViewing?: () => void
  onRetryGenres?: () => void
}) {
  const { t, i18n } = useTranslation()
  const notAvailableLabel = t('common.notAvailable')

  const numberFormatter = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  })
  const percentageFormatter = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
    style: 'percent',
  })

  const movieMinutes = viewingStats?.movieTimeWatchedMinutes ?? 0
  const seriesMinutes = viewingStats?.tvTimeWatchedMinutes ?? 0
  const totalMinutes = movieMinutes + seriesMinutes

  const movieShare = totalMinutes > 0 ? (movieMinutes / totalMinutes) * 100 : 0

  const seriesShare = totalMinutes > 0 ? (seriesMinutes / totalMinutes) * 100 : 0
  const formatPercentage = (value: number) => percentageFormatter.format(value / 100)
  const weekdayMediaSplit = viewingStats?.weekdayMediaSplit
  const weekendMediaSplit = viewingStats?.weekendMediaSplit
  const hasMediaSplitActivity =
    (weekdayMediaSplit?.movies ?? 0) +
      (weekdayMediaSplit?.series ?? 0) +
      (weekendMediaSplit?.movies ?? 0) +
      (weekendMediaSplit?.series ?? 0) >
    0

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-sm font-bold text-kino-text">{t('stats.watchingHabits')}</h2>

        <p className="mt-1 text-xs text-kino-muted">{t('stats.watchingHabitsDescription')}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-sm">{t('stats.moviesVsSeries')}</CardTitle>
          </CardHeader>

          <CardContent className="px-5 pb-5">
            {viewingLoading ? (
              <WatchingCardSkeleton />
            ) : viewingError ? (
              <RetryState onRetry={onRetryViewing} />
            ) : totalMinutes > 0 ? (
              <div className="grid gap-3">
                <div
                  aria-label={t('stats.viewingBreakdownChartLabel')}
                  className="flex h-2.5 overflow-hidden rounded-full bg-white/6"
                  role="img"
                >
                  <div className="bg-kino-accent" style={{ width: `${movieShare}%` }} />

                  <div className="bg-white/25" style={{ width: `${seriesShare}%` }} />
                </div>

                <div className="flex items-center justify-between gap-4 text-xs text-kino-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-kino-accent" />
                    {t('stats.movies')} · {formatPercentage(movieShare)}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm bg-white/25" />
                    {t('stats.series')} · {formatPercentage(seriesShare)}
                  </span>
                </div>
                <MediaSplitGrid
                  formatPercentage={formatPercentage}
                  movieLabel={t('stats.movies')}
                  notAvailableLabel={notAvailableLabel}
                  seriesLabel={t('stats.series')}
                  splits={[
                    {
                      label: t('stats.weekdays'),
                      split: weekdayMediaSplit,
                    },
                    {
                      label: t('stats.weekends'),
                      split: weekendMediaSplit,
                    },
                  ]}
                />
              </div>
            ) : hasMediaSplitActivity ? (
              <MediaSplitGrid
                formatPercentage={formatPercentage}
                movieLabel={t('stats.movies')}
                notAvailableLabel={notAvailableLabel}
                seriesLabel={t('stats.series')}
                splits={[
                  {
                    label: t('stats.weekdays'),
                    split: weekdayMediaSplit,
                  },
                  {
                    label: t('stats.weekends'),
                    split: weekendMediaSplit,
                  },
                ]}
              />
            ) : (
              <p className="text-sm text-kino-muted">{t('stats.noViewingActivity')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-sm">{t('stats.media')}</CardTitle>
          </CardHeader>

          <CardContent className="px-5 pb-5">
            {viewingLoading ? (
              <WatchingCardSkeleton rows={3} />
            ) : viewingError ? (
              <RetryState onRetry={onRetryViewing} />
            ) : (
              <div>
                <MetricRow
                  label={t('stats.averageMovieRuntime')}
                  value={
                    viewingStats?.averageMovieRuntimeMinutes
                      ? formatWatchTimeCompact(
                          viewingStats.averageMovieRuntimeMinutes,
                          i18n.language
                        )
                      : notAvailableLabel
                  }
                />

                <MetricRow
                  label={t('stats.averageEpisodesPerSeries')}
                  value={
                    viewingStats?.averageEpisodesPerSeries
                      ? numberFormatter.format(viewingStats.averageEpisodesPerSeries)
                      : notAvailableLabel
                  }
                />

                <MetricRow
                  label={t('stats.longestBinge')}
                  value={
                    viewingStats?.longestBingeEpisodes
                      ? `${numberFormatter.format(
                          viewingStats.longestBingeEpisodes
                        )} ${t('stats.episodesShort')}`
                      : notAvailableLabel
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-sm">{t('stats.mostWatchedGenres')}</CardTitle>
          </CardHeader>

          <CardContent className="px-5 pb-5">
            {genreLoading ? (
              <WatchingCardSkeleton rows={4} />
            ) : genreError ? (
              <RetryState onRetry={onRetryGenres} />
            ) : genreStats?.length ? (
              <ProfileCompositionBarChart
                countLabel={t('stats.count')}
                data={genreStats.slice(0, 4).map((item) => ({
                  label: getLocalizedGenreName({ id: item.genreId, name: item.name }, t),
                  count: item.count,
                  percentage: item.percentage,
                }))}
                formatCount={(value) => numberFormatter.format(value)}
                formatPercentage={formatPercentage}
                percentageLabel={t('stats.percentage')}
              />
            ) : (
              <p className="text-sm text-kino-muted">{t('stats.noGenreActivity')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-sm">{t('stats.decadesWatched')}</CardTitle>
          </CardHeader>

          <CardContent className="px-5 pb-5">
            {decades.length ? (
              <ProfileCompositionBarChart
                countLabel={t('stats.count')}
                data={decades.slice(0, 4)}
                formatCount={(value) => numberFormatter.format(value)}
                formatPercentage={formatPercentage}
                percentageLabel={t('stats.percentage')}
              />
            ) : (
              <p className="text-sm text-kino-muted">{t('stats.noDecadeActivity')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-xs text-kino-muted">{label}</span>

      <span className="text-sm font-semibold text-kino-text">{value}</span>
    </div>
  )
}

function MediaSplitGrid({
  splits,
  movieLabel,
  seriesLabel,
  notAvailableLabel,
  formatPercentage,
}: {
  splits: Array<{ label: string; split?: ProfileMediaSplit }>
  movieLabel: string
  seriesLabel: string
  notAvailableLabel: string
  formatPercentage: (value: number) => string
}) {
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
      {splits.map(({ label, split }) => {
        const dominantType = split?.dominantType ?? null
        const dominantLabel =
          dominantType === 'movie' ? movieLabel : dominantType === 'series' ? seriesLabel : null
        const dominantPercentage =
          dominantType === 'movie' ? (split?.moviePercentage ?? 0) : (split?.seriesPercentage ?? 0)

        return (
          <div className="min-w-0" key={label}>
            <div className="text-base font-bold text-kino-text">
              {dominantLabel
                ? `${formatPercentage(dominantPercentage)} ${dominantLabel}`
                : notAvailableLabel}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-kino-muted">
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RetryState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="grid min-h-20 place-items-center text-center">
      <div>
        <p className="text-xs text-kino-muted">{t('common.tryAgain')}</p>

        {onRetry ? (
          <Button className="mt-2" onClick={onRetry} size="sm" variant="outline">
            {t('common.retry')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function WatchingCardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center gap-3" key={index}>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-2 flex-1" />
        </div>
      ))}
    </div>
  )
}
