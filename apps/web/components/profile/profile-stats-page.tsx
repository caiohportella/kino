'use client'

import type { UIDiaryEntry, WatchedSeries } from '@kino/core'
import { Calendar, Download } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import {
  PROFILE_ACTIVITY_LEVEL_COLORS,
  ProfileActivityHeatmap,
} from '@/components/profile/profile-activity-heatmap'
import { ProfileRatingStatsCard } from '@/components/profile/profile-rating-stats-card'
import { ProfileStatSummaryCard } from '@/components/profile/profile-stat-summary-card'
import { ProfileWatchingHabitsCard } from '@/components/profile/profile-watching-habits-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { HeatmapDatum } from '@/components/ui/heatmap-calendar'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfileIdentity } from '@/hooks/profile/use-profile-sections'
import {
  useProfileDiaryEntries,
  useProfileGenreStats,
  useProfileLifetimeRecap,
  useProfileMediaStats,
  useProfileRatingStats,
  useProfileStats,
  useProfileViewingBreakdownStats,
  useProfileWatchedSeries,
} from '@/hooks/profile/use-profile-stats'
import { useLocalizedTitleNames } from '@/hooks/title/use-localized-title-names'
import { type LocalizedTitleRequest, localizedTitleKey } from '@/hooks/title/use-localized-titles'
import { useTranslation } from '@/lib/localization/i18n'
import { formatWatchTimeCompact } from '@/lib/profile/profile-stats'
import { profileStatsRecapPath } from '@/lib/routes'
import { db } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'
import { HighsAndLowsCard } from './highs-and-lows-card'
import { ProfileLifetimeTopRatedSection } from './profile-lifetime-top-rated-section'

export function ProfileStatsPage({
  profileId,
  username,
  displayName,
}: {
  profileId: string
  username: string
  displayName: string
}) {
  const { t, i18n } = useTranslation()
  const viewer = useAuthStore((state) => state.user)

  const visibilityScope = viewer?.id
    ? ({ kind: 'authenticated', userId: viewer.id } as const)
    : ({ kind: 'public' } as const)

  const stats = useProfileStats({ profileId, service: db, visibilityScope })
  const lifetimeRecap = useProfileLifetimeRecap({
    profileId,
    service: db,
    visibilityScope,
  })
  const profileIdentity = useProfileIdentity({
    profileId,
    service: db,
    visibilityScope,
  })
  const mediaStats = useProfileMediaStats({
    profileId,
    service: db,
    visibilityScope,
  })
  const viewingBreakdownStats = useProfileViewingBreakdownStats({
    profileId,
    service: db,
    visibilityScope,
  })
  const genreStats = useProfileGenreStats({
    profileId,
    service: db,
    visibilityScope,
    limit: 5,
  })
  const ratingStats = useProfileRatingStats({
    profileId,
    service: db,
    visibilityScope,
  })
  const diaryEntries = useProfileDiaryEntries({
    profileId,
    service: db,
    visibilityScope,
  })
  const watchedSeries = useProfileWatchedSeries({
    profileId,
    service: db,
    visibilityScope,
  })

  const joinedDate = profileIdentity.data?.created_at
    ? new Date(profileIdentity.data.created_at)
    : null
  const joinedYear = joinedDate?.getUTCFullYear() ?? null
  const joinedMonth =
    joinedDate != null
      ? new Intl.DateTimeFormat(i18n.language, {
          month: 'long',
          timeZone: 'UTC',
        }).format(joinedDate)
      : null

  const now = new Date()
  const recapHref = profileStatsRecapPath(username, now.getUTCFullYear(), now.getUTCMonth() + 1)
  const lifetimeRecapHref = `/api/${encodeURIComponent(username)}/stats/recap/lifetime`

  const analytics = useMemo(
    () => buildAnalytics(diaryEntries.data ?? [], watchedSeries.data ?? [], i18n.language),
    [diaryEntries.data, watchedSeries.data, i18n.language]
  )

  const titleRequestById = useMemo(() => {
    const requests = new Map<string, LocalizedTitleRequest>()

    for (const entry of diaryEntries.data ?? []) {
      requests.set(entry.titleId, {
        tmdbId: entry.tmdbId,
        type: entry.type,
      })
    }

    for (const series of watchedSeries.data ?? []) {
      requests.set(series.id, {
        tmdbId: series.tmdb_id,
        type: 'tv',
      })
    }

    return requests
  }, [diaryEntries.data, watchedSeries.data])

  const localizedTitleRequests = useMemo(() => {
    const requests = new Map<string, LocalizedTitleRequest>()

    function add(request: LocalizedTitleRequest | undefined) {
      if (!request) return
      requests.set(localizedTitleKey(request), request)
    }

    add(analytics.firstDiaryEntry?.request)
    add(analytics.mostRewatched?.request)
    add(analytics.longestMovie?.request)
    add(analytics.longestFinishedSeries?.request)

    const ratedTitles = [
      ratingStats.data?.highestRatedMovie,
      ratingStats.data?.lowestRatedMovie,
      ratingStats.data?.highestRatedSeries,
      ratingStats.data?.lowestRatedSeries,
    ]

    for (const title of ratedTitles) {
      if (!title) continue
      add(titleRequestById.get(title.titleId))
    }

    return Array.from(requests.values())
  }, [analytics, ratingStats.data, titleRequestById])

  const localizedTitleNames = useLocalizedTitleNames(localizedTitleRequests)

  const localizedAnalytics = useMemo(() => {
    function localize<
      T extends {
        title: string
        request: LocalizedTitleRequest
      },
    >(item: T | null): T | null {
      if (!item) return null

      const localizedTitle = localizedTitleNames.data[localizedTitleKey(item.request)]

      if (!localizedTitle) {
        return item
      }

      return {
        ...item,
        title: localizedTitle,
      }
    }

    return {
      ...analytics,
      firstDiaryEntry: localize(analytics.firstDiaryEntry),
      mostRewatched: localize(analytics.mostRewatched),
      longestMovie: localize(analytics.longestMovie),
      longestFinishedSeries: localize(analytics.longestFinishedSeries),
    }
  }, [analytics, localizedTitleNames.data])

  const localizedRatingStats = useMemo(() => {
    const stats = ratingStats.data

    if (!stats) return undefined

    const localizeRatedTitle = (title: typeof stats.highestRatedMovie) => {
      if (!title) return null

      const request = titleRequestById.get(title.titleId)
      if (!request) return title

      const localizedTitle = localizedTitleNames.data[localizedTitleKey(request)]

      if (!localizedTitle) {
        return title
      }

      return {
        ...title,
        title: localizedTitle,
      }
    }

    return {
      ...stats,
      highestRatedMovie: localizeRatedTitle(stats.highestRatedMovie),
      lowestRatedMovie: localizeRatedTitle(stats.lowestRatedMovie),
      highestRatedSeries: localizeRatedTitle(stats.highestRatedSeries),
      lowestRatedSeries: localizeRatedTitle(stats.lowestRatedSeries),
    }
  }, [ratingStats.data, titleRequestById, localizedTitleNames.data])

  return (
    <div className="content-frame mx-auto w-full max-w-304">
      <PageHeader
        action={
          <>
            <Button nativeButton={false} render={<Link href={recapHref} />} variant="secondary">
              <Calendar aria-hidden="true" size={15} />
              {t('stats.monthlyRecap')}
            </Button>

            <Button
              nativeButton={false}
              render={<a href={lifetimeRecapHref} />}
              variant="secondary"
            >
              <Download aria-hidden="true" size={15} />
              {t('stats.lifetimeRecap')}
            </Button>
          </>
        }
        eyebrow={profileName(username)}
        title={t('stats.pageTitle', { name: displayName })}
      />

      <div className="grid gap-5">
        <ProfileStatSummaryCard
          error={stats.isError}
          joinedMonth={joinedMonth}
          joinedYear={joinedYear}
          loading={stats.isPending}
          onRetry={() => {
            void stats.refetch()
            void mediaStats.refetch()
          }}
          stats={stats.data}
          mediaStats={mediaStats.data}
          variant="lifetime"
        />

        <WatchActivityCard
          activeDays={analytics.activeDays}
          busiestDay={analytics.busiestDay}
          heatmap={analytics.heatmap}
          longestStreak={analytics.longestStreak}
          loading={diaryEntries.isPending}
          totalDays={365}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <HighsAndLowsCard
            description={t('stats.highsAndLowsDescription')}
            emptyLabel={t('stats.noViewingActivity')}
            highestRatedLabel={t('stats.highestRated')}
            lowestRatedLabel={t('stats.lowestRated')}
            highestRatedMovie={localizedRatingStats?.highestRatedMovie ?? null}
            highestRatedSeries={localizedRatingStats?.highestRatedSeries ?? null}
            lowestRatedMovie={localizedRatingStats?.lowestRatedMovie ?? null}
            lowestRatedSeries={localizedRatingStats?.lowestRatedSeries ?? null}
            movieLabel={t('common.movie')}
            seriesLabel={t('common.series')}
            title={t('stats.highsAndLows')}
          />

          <MilestonesCard
            firstDiaryEntry={localizedAnalytics.firstDiaryEntry}
            longestFinishedSeries={localizedAnalytics.longestFinishedSeries}
            longestMovie={localizedAnalytics.longestMovie}
            mostRewatched={localizedAnalytics.mostRewatched}
          />
        </div>

        <ProfileRatingStatsCard
          error={ratingStats.isError}
          loading={ratingStats.isPending}
          onRetry={() => void ratingStats.refetch()}
          stats={ratingStats.data}
        />

        <ProfileLifetimeTopRatedSection
          error={lifetimeRecap.isError}
          items={lifetimeRecap.data?.topRatedMovies ?? []}
          loading={lifetimeRecap.isPending}
          mediaType="movie"
          onRetry={() => void lifetimeRecap.refetch()}
          title={t('profile.topRatedMovies')}
        />

        <ProfileLifetimeTopRatedSection
          error={lifetimeRecap.isError}
          items={lifetimeRecap.data?.topRatedSeries ?? []}
          loading={lifetimeRecap.isPending}
          mediaType="tv"
          onRetry={() => void lifetimeRecap.refetch()}
          title={t('profile.topRatedSeries')}
        />

        <ProfileWatchingHabitsCard
          decades={analytics.decades}
          genreError={genreStats.isError}
          genreLoading={genreStats.isPending}
          genreStats={genreStats.data}
          onRetryGenres={() => void genreStats.refetch()}
          onRetryViewing={() => void viewingBreakdownStats.refetch()}
          viewingError={viewingBreakdownStats.isError}
          viewingLoading={viewingBreakdownStats.isPending}
          viewingStats={viewingBreakdownStats.data}
        />
      </div>
    </div>
  )
}

function WatchActivityCard({
  activeDays,
  busiestDay,
  heatmap,
  longestStreak,
  loading,
  totalDays,
}: {
  activeDays: number
  busiestDay: { label: string; entries: number } | null
  heatmap: HeatmapDatum[]
  longestStreak: number
  loading: boolean
  totalDays: number
}) {
  const { t, i18n } = useTranslation()
  const notAvailableLabel = t('common.notAvailable')

  if (loading) {
    return (
      <Card className="gap-0 p-0">
        <CardHeader className="gap-2 px-5 pt-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5">
          <Skeleton className="h-52 w-full rounded-md" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-sm font-bold text-kino-text">
            {t('stats.watchActivity')}
          </CardTitle>

          <ProfileActivityLegend lessLabel={t('stats.less')} moreLabel={t('stats.more')} />
        </div>

        <CardDescription className="text-xs text-kino-muted">
          {t('stats.watchActivityDescription')}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-4">
        <ProfileActivityHeatmap data={heatmap} endDate={new Date()} rangeDays={totalDays} />

        <div className="mt-5 grid gap-6 border-t border-white/10 pt-4 sm:grid-cols-3">
          <StatPill
            label={t('stats.longestStreak')}
            value={new Intl.NumberFormat(i18n.language).format(longestStreak)}
          />

          <StatPill
            label={t('stats.busiestDay')}
            value={busiestDay ? `${busiestDay.label} · ${busiestDay.entries}` : notAvailableLabel}
          />

          <StatPill
            label={t('stats.activeDays')}
            value={new Intl.NumberFormat(i18n.language).format(activeDays)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function MilestonesCard({
  firstDiaryEntry,
  mostRewatched,
  longestMovie,
  longestFinishedSeries,
}: {
  firstDiaryEntry: RankedDiaryEntry | null
  mostRewatched: RankedDiaryEntry | null
  longestMovie: RankedDiaryEntry | null
  longestFinishedSeries: FinishedSeriesSummary | null
}) {
  const { t } = useTranslation()
  const notAvailableLabel = t('common.notAvailable')

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-lg font-bold text-kino-text">{t('stats.milestones')}</CardTitle>

        <CardDescription className="text-xs text-kino-muted">
          {t('stats.milestonesDescription')}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-3">
        <MilestoneRow
          detail={firstDiaryEntry?.detail}
          detailPrefix={t('stats.loggedOn')}
          label={t('stats.firstDiaryEntry')}
          value={firstDiaryEntry?.title ?? notAvailableLabel}
        />

        <MilestoneRow
          detail={mostRewatched?.detail}
          detailPrefix={t('stats.lastRewatch')}
          label={t('stats.mostRewatched')}
          value={
            mostRewatched
              ? `${mostRewatched.title} · ${t('stats.rewatchCount', {
                  count: mostRewatched.count ?? 0,
                })}`
              : notAvailableLabel
          }
        />

        <MilestoneRow
          detail={longestMovie?.detail}
          detailPrefix={t('stats.watchedOn')}
          label={t('stats.longestMovieWatched')}
          value={
            longestMovie
              ? `${longestMovie.title} · ${longestMovie.runtimeLabel}`
              : notAvailableLabel
          }
        />

        <MilestoneRow
          detail={longestFinishedSeries?.detail}
          detailPrefix={t('stats.lastWatchedOn')}
          label={t('stats.longestFinishedSeries')}
          value={
            longestFinishedSeries
              ? `${longestFinishedSeries.title} · ${
                  longestFinishedSeries.episodeCount
                } ${t('stats.episodesShort')}`
              : notAvailableLabel
          }
        />
      </CardContent>
    </Card>
  )
}

function MilestoneRow({
  label,
  value,
  detail,
  detailPrefix,
}: {
  label: string
  value: string
  detail?: string
  detailPrefix?: string
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-white/10 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <span className="pt-0.5 text-sm text-kino-muted">{label}</span>

      <div className="max-w-[62%] text-right">
        <div className="text-sm font-semibold text-kino-text">{value}</div>

        {detail ? (
          <div className="mt-1 text-xs text-kino-muted">
            {detailPrefix ? `${detailPrefix} ${detail}` : detail}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProfileActivityLegend({ lessLabel, moreLabel }: { lessLabel: string; moreLabel: string }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 text-[11px] text-kino-muted"
      aria-label={`${lessLabel} ${moreLabel}`}
    >
      <span>{lessLabel}</span>

      <div className="flex items-center gap-1" aria-hidden="true">
        {PROFILE_ACTIVITY_LEVEL_COLORS.map((color) => (
          <span key={color} className="size-3 rounded-[3px]" style={{ backgroundColor: color }} />
        ))}
      </div>

      <span>{moreLabel}</span>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-bold text-kino-text">{value}</div>

      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-kino-muted">
        {label}
      </div>
    </div>
  )
}

function profileName(username: string) {
  return username ? `@${username}` : ''
}

type RankedDiaryEntry = {
  title: string
  detail: string
  request: LocalizedTitleRequest
  rating?: number | null
  runtimeLabel?: string
  count?: number
}

type FinishedSeriesSummary = {
  title: string
  episodeCount: number
  detail: string
  request: LocalizedTitleRequest
}

function buildAnalytics(
  diaryEntries: UIDiaryEntry[],
  watchedSeries: WatchedSeries[],
  locale: string
) {
  const byDay = new Map<string, number>()
  const byTitle = new Map<
    string,
    {
      count: number
      title: string
      rating: number
      type: UIDiaryEntry['type']
      runtime?: number
      watchedAt: string
    }
  >()
  const decadeCounts = new Map<string, number>()

  const ordered = [...diaryEntries].sort(
    (a, b) => Date.parse(a.watchedAt) - Date.parse(b.watchedAt)
  )

  for (const entry of ordered) {
    const date = localDateKey(new Date(entry.watchedAt))
    byDay.set(date, (byDay.get(date) ?? 0) + 1)

    const current = byTitle.get(entry.titleId) ?? {
      count: 0,
      title: entry.titleName,
      rating: entry.rating ?? 0,
      type: entry.type,
      runtime: entry.runtime,
      watchedAt: entry.watchedAt,
    }

    current.count += 1
    current.rating = Math.max(current.rating ?? 0, entry.rating ?? 0)
    current.type = entry.type
    current.title = entry.titleName
    current.runtime = entry.runtime ?? current.runtime
    current.watchedAt = entry.watchedAt
    byTitle.set(entry.titleId, current)

    const year = entry.releaseYear
    if (year > 0) {
      const decade = `${Math.floor(year / 10) * 10}s`
      const weight = entry.type === 'movie' ? 1 : 0.2
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + weight)
    }
  }

  const heatmap: HeatmapDatum[] = Array.from(byDay.entries()).map(([date, value]) => ({
    date,
    value,
  }))

  let longestStreak = 0
  let currentStreak = 0
  let previous = ''

  for (const day of Array.from(byDay.keys()).sort()) {
    if (previous && isConsecutiveDay(previous, day)) currentStreak += 1
    else currentStreak = 1

    longestStreak = Math.max(longestStreak, currentStreak)
    previous = day
  }

  const busiest = Array.from(byDay.entries()).sort(
    (a, b) => b[1] - a[1] || b[0].localeCompare(a[0])
  )[0]

  const busiestDay = busiest
    ? { label: formatDayLabel(busiest[0], locale), entries: busiest[1] }
    : null

  const firstDiary = ordered[0]

  const rewatchMap = ordered.reduce(
    (map, entry) => {
      if (entry.watchType !== 'rewatch') return map

      const current = map.get(entry.titleId) ?? {
        count: 0,
        title: entry.titleName,
        lastWatchedAt: entry.watchedAt,
        tmdbId: entry.tmdbId,
        type: entry.type,
      }

      current.count += 1
      current.title = entry.titleName

      if (new Date(entry.watchedAt).getTime() > new Date(current.lastWatchedAt).getTime()) {
        current.lastWatchedAt = entry.watchedAt
      }

      map.set(entry.titleId, current)
      return map
    },
    new Map<
      string,
      {
        count: number
        title: string
        lastWatchedAt: string
        tmdbId: number
        type: UIDiaryEntry['type']
      }
    >()
  )

  const rewatched = Array.from(rewatchMap.values()).sort(
    (a, b) => b.count - a.count || a.title.localeCompare(b.title)
  )[0]

  const longestMovie = ordered
    .filter((entry) => entry.type === 'movie' && (entry.runtime ?? 0) > 0)
    .sort(
      (a, b) => (b.runtime ?? 0) - (a.runtime ?? 0) || a.titleName.localeCompare(b.titleName)
    )[0]

  const finishedSeries = watchedSeries
    .filter((series) => series.is_series_completed)
    .sort(
      (a, b) =>
        (b.watched_episode_count ?? 0) - (a.watched_episode_count ?? 0) ||
        a.title.localeCompare(b.title)
    )[0]

  const decades = Array.from(decadeCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  const totalDecadeCount = decades.reduce((total, item) => total + item.count, 0)

  const decadeStats = decades.map((item) => ({
    ...item,
    percentage: totalDecadeCount > 0 ? (item.count / totalDecadeCount) * 100 : 0,
  }))

  return {
    activeDays: byDay.size,
    busiestDay,
    decades: decadeStats,
    firstDiaryEntry: firstDiary
      ? {
          title: firstDiary.titleName,
          detail: formatWatchedAt(firstDiary.watchedAt, locale),
          request: {
            tmdbId: firstDiary.tmdbId,
            type: firstDiary.type,
          },
        }
      : null,
    longestFinishedSeries: finishedSeries
      ? {
          title: finishedSeries.title,
          episodeCount: finishedSeries.watched_episode_count ?? 0,
          detail: formatWatchedAt(finishedSeries.latest_watched_at, locale),
          request: {
            tmdbId: finishedSeries.tmdb_id,
            type: 'tv' as const,
          },
        }
      : null,
    longestMovie: longestMovie
      ? {
          title: longestMovie.titleName,
          detail: formatWatchedAt(longestMovie.watchedAt, locale),
          runtimeLabel: formatRuntime(longestMovie.runtime ?? 0, locale),
          request: {
            tmdbId: longestMovie.tmdbId,
            type: longestMovie.type,
          },
        }
      : null,
    longestStreak,
    mostRewatched: rewatched
      ? {
          title: rewatched.title,
          detail: formatWatchedAt(rewatched.lastWatchedAt, locale),
          count: rewatched.count,
          request: {
            tmdbId: rewatched.tmdbId,
            type: rewatched.type,
          },
        }
      : null,
    heatmap,
  }
}

function formatRuntime(minutes: number, locale: string) {
  return formatWatchTimeCompact(minutes, locale)
}

function formatWatchedAt(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function formatDayLabel(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isConsecutiveDay(left: string, right: string) {
  const leftDate = Date.UTC(
    Number(left.slice(0, 4)),
    Number(left.slice(5, 7)) - 1,
    Number(left.slice(8, 10))
  )

  const rightDate = Date.UTC(
    Number(right.slice(0, 4)),
    Number(right.slice(5, 7)) - 1,
    Number(right.slice(8, 10))
  )

  return rightDate - leftDate === 24 * 60 * 60 * 1000
}
