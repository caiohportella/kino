'use client'

import type { ProfileMonthlyRecapActivityDay } from '@kino/core'
import { Film, Tv } from 'lucide-react'
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { buildMonthlyWatchCalendar } from '@/lib/monthly-watch-calendar'
import { formatProfileMonth } from '@/lib/profile-recap'
import { formatWatchTimeCompact } from '@/lib/profile-stats'
import { cn } from '@/lib/utils'
import { PROFILE_ACTIVITY_LEVEL_COLORS } from './profile-activity-heatmap'

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) {
    return null
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function formatDate(dateKey: string, locale: string, options: Intl.DateTimeFormatOptions) {
  const date = parseDateKey(dateKey)
  if (!date) {
    return dateKey
  }

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: 'UTC',
  }).format(date)
}

function weekdayLabels(locale: string) {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2024, 0, 1 + index)))
  )
}

function CalendarSummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-kino-muted">
        {label}
      </div>

      <div className="mt-2 text-sm font-semibold text-kino-text">{value}</div>

      {detail ? <div className="mt-1 text-xs text-kino-muted">{detail}</div> : null}
    </div>
  )
}

export function MonthlyWatchCalendar({
  year,
  month,
  dailyActivity,
}: {
  year: number
  month: number
  dailyActivity: ProfileMonthlyRecapActivityDay[]
}) {
  const { t, i18n } = useTranslation()

  const model = useMemo(
    () =>
      buildMonthlyWatchCalendar({
        year,
        month,
        dailyActivity,
      }),
    [dailyActivity, month, year]
  )

  const weekdays = useMemo(() => weekdayLabels(i18n.language), [i18n.language])
  const numberFormatter = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  const monthLabel = useMemo(
    () => formatProfileMonth(year, month, i18n.language),
    [i18n.language, month, year]
  )

  const activeDaysValue = `${numberFormatter.format(model.activeDays)} ${t('stats.duration.days', {
    count: model.activeDays,
  })}`

  const longestStreakValue = `${numberFormatter.format(model.longestStreak)} ${t(
    'stats.duration.days',
    {
      count: model.longestStreak,
    }
  )}`

  const mostActiveDayValue = model.mostActiveDay
    ? formatDate(model.mostActiveDay.date, i18n.language, {
        day: 'numeric',
        month: 'short',
      })
    : t('stats.noActivity')

  const mostActiveDayDetail = model.mostActiveDay
    ? `${formatWatchTimeCompact(model.mostActiveDay.minutes, i18n.language)} · ${t('stats.mostActiveDayIndicator')}`
    : undefined

  const biggestBingeValue =
    model.biggestBingeDay && model.biggestBingeDay.episodesWatched > 0
      ? formatDate(model.biggestBingeDay.date, i18n.language, {
          day: 'numeric',
          month: 'short',
        })
      : t('stats.noEpisodes')

  const biggestBingeDetail =
    model.biggestBingeDay && model.biggestBingeDay.episodesWatched > 0
      ? `${numberFormatter.format(model.biggestBingeDay.episodesWatched)} ${t('stats.episodesWatched')} · ${formatWatchTimeCompact(model.biggestBingeDay.minutes, i18n.language)}`
      : undefined

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-sm font-bold text-kino-text">
          {t('stats.watchCalendar')}
        </CardTitle>

        <p className="text-xs text-kino-muted">
          {t('stats.watchCalendarDescription', { month: monthLabel })}
        </p>
      </CardHeader>

      <CardContent className="grid gap-6 px-4 pb-6 pt-4 sm:px-6">
        <div className="grid gap-2">
          <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map((label, index) => (
              <div
                className="min-w-0 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-kino-muted"
                key={`${label}-${index}`}
                role="columnheader"
              >
                {label}
              </div>
            ))}
          </div>

          <TooltipProvider delay={80}>
            <div className="grid gap-1.5" role="grid" aria-label={t('stats.watchCalendar')}>
              {model.weeks.map((week, weekIndex) => (
                <div className="grid grid-cols-7 gap-1.5" key={weekIndex} role="row">
                  {week.map((cell) => {
                    if (!cell.inMonth) {
                      return (
                        <div
                          aria-hidden="true"
                          className="aspect-square rounded-[12px] border border-transparent bg-transparent"
                          key={cell.date}
                        />
                      )
                    }

                    const activity = cell.activity
                    const hasActivity = activity !== null
                    const isMostActive = cell.date === model.mostActiveDay?.date
                    const dayNumber = formatDate(cell.date, i18n.language, {
                      day: 'numeric',
                    })
                    const date = formatDate(cell.date, i18n.language, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                    const movies = activity
                      ? `${numberFormatter.format(activity.moviesWatched)} ${t('stats.moviesWatched')}`
                      : ''
                    const episodes = activity
                      ? activity.episodesWatched > 0
                        ? `${numberFormatter.format(activity.episodesWatched)} ${t('stats.episodesWatched')}`
                        : t('stats.noEpisodes')
                      : ''
                    const duration = activity
                      ? formatWatchTimeCompact(activity.minutes, i18n.language, t)
                      : ''

                    const activityLabel = activity
                      ? t('stats.calendarDayLabel', { date, movies, episodes, duration })
                      : `${date}, ${t('stats.noActivity')}`

                    const cellBody = (
                      <div
                        className={cn(
                          'relative flex aspect-square flex-col rounded-[12px] border p-1.5 text-left transition-transform',
                          hasActivity
                            ? 'border-white/10 text-white hover:-translate-y-0.5 focus-visible:-translate-y-0.5'
                            : 'border-white/5 bg-white/3 text-kino-muted'
                        )}
                        style={
                          activity
                            ? { backgroundColor: PROFILE_ACTIVITY_LEVEL_COLORS[cell.level] }
                            : undefined
                        }
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={cn(
                              'text-[11px] font-semibold leading-none',
                              hasActivity ? 'text-white' : 'text-kino-muted'
                            )}
                          >
                            {dayNumber}
                          </span>

                          {isMostActive ? (
                            <span
                              aria-hidden="true"
                              className="mt-0.5 inline-flex size-2 rounded-full bg-kino-accent ring-2 ring-kino-accent/20"
                            />
                          ) : null}
                        </div>

                        {activity ? (
                          <div className="mt-auto grid gap-1 text-[9px] leading-tight">
                            <div className="flex items-center gap-2 text-white/90">
                              <span className="inline-flex items-center gap-1">
                                <Film size={10} strokeWidth={2.2} />
                                {numberFormatter.format(activity.moviesWatched)}
                              </span>

                              <span className="inline-flex items-center gap-1">
                                <Tv size={10} strokeWidth={2.2} />
                                {numberFormatter.format(activity.episodesWatched)}
                              </span>
                            </div>

                            <div className="font-semibold text-white">
                              {formatWatchTimeCompact(activity.minutes, i18n.language)}
                            </div>
                          </div>
                        ) : null}

                        {isMostActive ? (
                          <span className="sr-only">{t('stats.mostActiveDayIndicator')}</span>
                        ) : null}
                      </div>
                    )

                    if (!activity) {
                      return (
                        <div aria-label={activityLabel} key={cell.date} role="gridcell">
                          {cellBody}
                        </div>
                      )
                    }

                    return (
                      <Tooltip key={cell.date}>
                        <TooltipTrigger
                          render={
                            <button
                              aria-label={activityLabel}
                              className="w-full rounded-[12px] text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-kino-accent focus-visible:ring-offset-2"
                              role="gridcell"
                              tabIndex={0}
                              type="button"
                            >
                              {cellBody}
                            </button>
                          }
                        />

                        <TooltipContent side="top">
                          <div className="grid gap-1">
                            <div className="text-sm font-medium text-kino-text">{date}</div>

                            <div className="text-xs text-kino-muted">
                              {numberFormatter.format(activity.moviesWatched)}{' '}
                              {t('stats.moviesWatched')}
                            </div>

                            <div className="text-xs text-kino-muted">
                              {activity.episodesWatched > 0
                                ? `${numberFormatter.format(activity.episodesWatched)} ${t('stats.episodesWatched')}`
                                : t('stats.noEpisodes')}
                            </div>

                            <div className="text-xs text-kino-muted">
                              {formatWatchTimeCompact(activity.minutes, i18n.language)}
                            </div>

                            {isMostActive ? (
                              <div className="text-xs font-semibold text-kino-accent">
                                {t('stats.mostActiveDayIndicator')}
                              </div>
                            ) : null}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </div>
          </TooltipProvider>

          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-kino-muted">
            <span>{t('stats.less')}</span>

            {PROFILE_ACTIVITY_LEVEL_COLORS.map((color) => (
              <span
                aria-hidden="true"
                className="size-3 rounded-[3px] border border-white/10"
                key={color}
                style={{ backgroundColor: color }}
              />
            ))}

            <span>{t('stats.more')}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CalendarSummaryCard label={t('stats.activeDays')} value={activeDaysValue} />

          <CalendarSummaryCard label={t('stats.longestStreak')} value={longestStreakValue} />

          <CalendarSummaryCard
            detail={mostActiveDayDetail}
            label={t('stats.mostActiveDay')}
            value={mostActiveDayValue}
          />

          <CalendarSummaryCard
            detail={biggestBingeDetail}
            label={t('stats.biggestBingeDay')}
            value={biggestBingeValue}
          />
        </div>
      </CardContent>
    </Card>
  )
}
