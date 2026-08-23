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
import { useTranslation } from '@/lib/localization/i18n'

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
    <section
      className="
        relative mb-8
        min-h-140
        overflow-hidden
        rounded-md
        border border-white/10
        bg-kino-surface

        lg:min-h-128
        xl:min-h-136
      "
    >
      <div className="absolute inset-0">
        {title.backdropImage ? (
          <img alt="" className="size-full object-cover object-center" src={title.backdropImage} />
        ) : (
          <div className="size-full bg-[linear-gradient(135deg,rgb(29_185_84/0.18),rgb(255_255_255/0.05)_45%,rgb(0_0_0/0.2))]" />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black/25" />

      <div
        className="
          pointer-events-none absolute inset-0
          hidden
          bg-linear-to-r
          from-kino-surface/95
          via-kino-surface/65
          to-kino-surface/10
          lg:block
        "
      />

      <div
        className="
          pointer-events-none absolute inset-0
          bg-linear-to-t
          from-kino-surface
          via-kino-surface/75
          to-black/10
          lg:hidden
        "
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-kino-surface/90 to-transparent" />

      <div
        className="
          relative z-10
          flex min-h-140
          flex-col
          items-center justify-end
          gap-6
          px-5 py-7
          text-center

          sm:px-8

          lg:min-h-128
          lg:flex-row
          lg:items-center
          lg:justify-start
          lg:gap-10
          lg:px-9
          lg:py-8
          lg:text-left

          xl:min-h-136
          xl:gap-12
          xl:px-10
        "
      >
        <div
          className="
            relative z-10
            w-40 shrink-0

            sm:w-48
            lg:w-56
            xl:w-60
          "
        >
          <Poster
            className="
              w-full
              border border-white/10
              shadow-[0_24px_64px_rgb(0_0_0/0.55)]
            "
            src={title.coverImage}
            title={title.title}
          />
        </div>

        <div
          className="
            flex min-w-0
            flex-1 flex-col
            items-center

            lg:items-start
          "
        >
          <div
            className="
              mb-2
              flex flex-wrap
              items-center justify-center
              gap-x-2.5 gap-y-1.5
              text-sm font-medium
              text-white/65

              lg:justify-start
            "
          >
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
              <span className="inline-flex min-h-6 items-center rounded-full border border-kino-accent/25 bg-kino-accent/10 px-2.5 text-xs font-semibold text-kino-text">
                {t('profile.completed')}
              </span>
            ) : null}
          </div>

          <h1
            className="
              max-w-3xl
              text-balance
              text-3xl font-semibold
              leading-[1.05]
              tracking-tight
              text-kino-text

              sm:text-4xl
              lg:text-[2.6rem]
              xl:text-5xl
            "
          >
            {title.title}
          </h1>

          {title.genres.length > 0 ? (
            <div
              className="
                mt-3
                flex flex-wrap
                justify-center gap-2

                lg:justify-start
              "
            >
              {title.genres.slice(0, 5).map((genre) => (
                <span
                  className="
                    rounded-md
                    border border-white/10
                    bg-black/25
                    px-2.5 py-1
                    text-xs font-semibold
                    text-kino-muted
                    backdrop-blur-sm
                  "
                  key={genre.id}
                >
                  {genre.name}
                </span>
              ))}
            </div>
          ) : null}

          {upcomingSeason ? (
            <div
              className="
                mt-4
                flex w-fit max-w-full
                items-center gap-2
                rounded-md
                border border-kino-accent/35
                bg-kino-accent/10
                px-3 py-2
                text-sm font-semibold
                text-kino-text
                backdrop-blur-sm
              "
            >
              <CalendarDays aria-hidden="true" size={16} />

              <span>
                {t('seasons.newSeasonComing', {
                  number: upcomingSeason.season_number,
                })}

                {upcomingSeason.air_date ? ` · ${formatDate(upcomingSeason.air_date)}` : ''}
              </span>
            </div>
          ) : null}

          <div
            className="
              mt-5
              flex w-full
              justify-center

              lg:justify-start
            "
          >
            {actions}
          </div>
        </div>
      </div>
    </section>
  )
}
