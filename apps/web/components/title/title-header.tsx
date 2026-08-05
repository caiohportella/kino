'use client'

import type { TitleDetails } from '@kino/core'
import {
  formatDate as formatKinoDate,
  formatRuntime,
  isCompletedSeriesStatus,
  isFutureDateOnly,
} from '@kino/core'
import { CalendarDays } from 'lucide-react'
import type { ReactNode } from 'react'

import { Poster } from '@/components/kino'
import { useTranslation } from '@/lib/i18n'

function parseTmdbDate(value: string) {
  const date = new Date(`${value}T12:00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string) {
  return formatKinoDate(parseTmdbDate(value) || value)
}

export function getUpcomingSeason(title: TitleDetails) {
  if (title.type !== 'tv') {
    return null
  }

  if (isCompletedSeriesStatus(title.status)) {
    return null
  }

  return (
    title.seasons
      ?.filter((season) => {
        if (season.season_number <= 0) {
          return false
        }

        return isFutureDateOnly(season.air_date)
      })
      .sort((left, right) => left.air_date.localeCompare(right.air_date))[0] ?? null
  )
}

type TitleHeaderProps = {
  actions: ReactNode
  title: TitleDetails
  upcomingSeason: ReturnType<typeof getUpcomingSeason>
}

export function TitleHeader({ actions, title, upcomingSeason }: TitleHeaderProps) {
  const { t } = useTranslation()

  return (
    <section className="relative mb-8 overflow-hidden rounded-md border border-white/10 bg-kino-surface">
      {/* Backdrop */}
      <div className="absolute inset-0">
        {title.backdropImage ? (
          <img
            alt=""
            className="h-full w-full scale-[1.02] object-cover object-center"
            src={title.backdropImage}
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,rgb(29_185_84/0.18),rgb(255_255_255/0.05)_45%,rgb(0_0_0/0.2))]" />
        )}
      </div>

      {/* Darkens the whole image slightly for readability */}
      <div className="pointer-events-none absolute inset-0 bg-black/25" />

      {/* Stronger desktop gradient from left to right */}
      <div className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-kino-surface/95 via-kino-surface/72 to-kino-surface/15 lg:block" />

      {/* Mobile gradient */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-kino-surface via-kino-surface/78 to-black/10 lg:hidden" />

      {/* Bottom blend into the rest of the page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-kino-surface to-transparent" />

      <div className="relative z-10 mx-auto grid min-h-176 w-full max-w-6xl content-end justify-items-center gap-6 px-5 pb-6 pt-28 text-center sm:px-8 `lg:min-h-144 lg:grid-cols-[clamp(180px,20vw,230px)_minmax(0,1fr)] lg:content-center lg:items-center lg:justify-items-stretch lg:gap-10 lg:px-10 lg:py-12 lg:text-left">
        {/* Poster */}
        <div className="relative z-10 w-36 shrink-0 sm:w-44 lg:w-full">
          <Poster
            className="w-full border border-white/10 shadow-[0_24px_70px_rgb(0_0_0/0.55)]"
            src={title.coverImage}
            title={title.title}
          />
        </div>

        {/* Metadata */}
        <div className="flex min-w-0 w-full max-w-3xl flex-col items-center justify-center lg:items-start">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-kino-muted lg:justify-start">
            <span>{title.type === 'tv' ? t('common.tv') : t('common.movie')}</span>

            <span aria-hidden="true">•</span>

            <span>{title.year || 'TBA'}</span>

            {title.runtime ? (
              <>
                <span aria-hidden="true">•</span>
                <span>{formatRuntime(title.runtime)}</span>
              </>
            ) : null}

            {title.totalSeasons ? (
              <>
                <span aria-hidden="true">•</span>
                <span>
                  {title.totalSeasons} {title.totalSeasons === 1 ? 'season' : 'seasons'}
                </span>
              </>
            ) : null}

            {title.type === 'tv' && isCompletedSeriesStatus(title.status) ? (
              <span className="inline-flex min-h-7 items-center rounded-full border border-kino-accent/25 bg-kino-accent/10 px-3 text-xs font-semibold text-kino-text">
                {t('profile.completed')}
              </span>
            ) : null}
          </div>

          <h1 className="max-w-4xl text-balance text-3xl font-semibold leading-tight text-kino-text sm:text-4xl lg:text-5xl">
            {title.title}
          </h1>

          {title.genres.length > 0 ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              {title.genres.slice(0, 5).map((genre) => (
                <span
                  className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-kino-muted backdrop-blur-sm"
                  key={genre.id}
                >
                  {genre.name}
                </span>
              ))}
            </div>
          ) : null}

          {upcomingSeason ? (
            <div className="mt-5 flex w-fit max-w-full items-center gap-2 rounded-md border border-kino-accent/35 bg-kino-accent/10 px-3 py-2 text-sm font-semibold text-kino-text backdrop-blur-sm">
              <CalendarDays aria-hidden="true" size={16} />

              <span>
                {t('seasons.newSeasonComing', {
                  number: upcomingSeason.season_number,
                })}

                {upcomingSeason.air_date ? ` · ${formatDate(upcomingSeason.air_date)}` : ''}
              </span>
            </div>
          ) : null}

          <div className="mt-7 flex w-full justify-center lg:justify-start">{actions}</div>
        </div>
      </div>
    </section>
  )
}
