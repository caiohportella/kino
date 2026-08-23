'use client'

import { findNextKnownSeason, formatDate, isFutureDateOnly, type WatchedSeries } from '@kino/core'
import Link from 'next/link'
import { useMemo } from 'react'
import { EmptyState, Poster } from '@/components/kino'
import { ProfileShelfError, ProfileShelfSkeleton } from '@/components/profile/profile-shelf-state'
import { ProfileTitleRow } from '@/components/profile/profile-title-row'
import { localizedTitleKey, useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import { useTranslation } from '@/lib/localization/i18n'
import { profileSeriesPath, titlePath } from '@/lib/routes'
import { getTmdb } from '@/lib/services'

export type ProfileSeriesShelfProps = {
  items: WatchedSeries[]
  username: string
}

export function ProfileSeriesShelf({ items, username }: ProfileSeriesShelfProps) {
  const { t } = useTranslation()

  const { keepWatchingSeries, returningSoonSeries, watchedSeries } = useMemo(() => {
    const keepWatchingSeries: WatchedSeries[] = []
    const returningSoonSeries: WatchedSeries[] = []
    const watchedSeries: WatchedSeries[] = []

    for (const series of items) {
      if (series.next_episode) {
        keepWatchingSeries.push(series)
        continue
      }

      if (findNextKnownSeason(series)) {
        returningSoonSeries.push(series)
        continue
      }

      watchedSeries.push(series)
    }

    return {
      keepWatchingSeries,
      returningSoonSeries,
      watchedSeries,
    }
  }, [items])

  const localizedTitleRequests = useMemo(
    () =>
      items.map((item) => ({
        tmdbId: item.tmdb_id,
        type: 'tv' as const,
      })),
    [items]
  )

  const localizedTitles = useLocalizedTitles(localizedTitleRequests)

  return (
    <>
      <ProfileSeriesShelfRow
        emptyBody={t('emptyStates.keepWatchingBody')}
        items={keepWatchingSeries}
        localizedTitles={localizedTitles}
        title={t('profile.keepWatching')}
      />

      <ProfileSeriesShelfRow
        items={returningSoonSeries}
        localizedTitles={localizedTitles}
        showUpcomingSeason
        title={t('profile.returningSoon')}
      />

      <ProfileSeriesShelfRow
        items={watchedSeries}
        localizedTitles={localizedTitles}
        previewLimit={15}
        showAllHref={profileSeriesPath(username)}
        title={t('profile.watchedSeries')}
      />
    </>
  )
}

function ProfileSeriesShelfRow({
  emptyBody,
  items,
  localizedTitles,
  previewLimit,
  showAllHref,
  showUpcomingSeason = false,
  title,
}: {
  emptyBody?: string
  items: WatchedSeries[]
  localizedTitles: ReturnType<typeof useLocalizedTitles>
  previewLimit?: number
  showAllHref?: string
  showUpcomingSeason?: boolean
  title: string
}) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return emptyBody ? (
      <section>
        <h2 className="mb-3 text-xl font-semibold text-kino-text">{title}</h2>

        <EmptyState
          body={emptyBody}
          size="compact"
          title={t('emptyStates.keepWatchingTitle')}
          variant="cinema"
        />
      </section>
    ) : null
  }

  if (localizedTitles.isPending) {
    return <ProfileShelfSkeleton title={title} />
  }

  if (localizedTitles.isError) {
    return <ProfileShelfError title={title} />
  }

  const renderTitleCard = (series: WatchedSeries) => {
    const localized =
      localizedTitles.data?.[
        localizedTitleKey({
          tmdbId: series.tmdb_id,
          type: 'tv',
        })
      ]

    const displayTitle = localized?.title || t('diary.unknownTitle')

    const posterPath = localized?.posterPath ?? null

    const releaseYear = localized?.year ?? series.release_year

    const nextKnownSeason = showUpcomingSeason ? findNextKnownSeason(series) : null

    const nextEpisodeLabel = series.next_episode
      ? `${t('profile.next')} ${t('profile.episodeCode', {
          episode: series.next_episode.episode,
          season: series.next_episode.season,
        })}`
      : null

    return (
      <Link
        className="group min-w-0 focus-ring"
        href={titlePath(series.tmdb_id, series.title, 'tv')}
        key={series.id}
      >
        <Poster
          className="w-full rounded-md"
          details={{
            completed: series.is_caught_up === true,
            nextEpisodeLabel,
            upcomingSeasonLabel: nextKnownSeason
              ? t('seasons.season', {
                  number: nextKnownSeason.season,
                })
              : null,
            year: releaseYear,
          }}
          src={getTmdb().getImageUrl(posterPath, 'w300')}
          title={displayTitle}
        />

        {series.next_episode ? null : <SeriesStatusPill series={series} />}
      </Link>
    )
  }

  return (
    <ProfileTitleRow
      desktopShowAllAction={!showAllHref}
      items={items}
      previewLimit={previewLimit}
      renderTitleCard={renderTitleCard}
      rowClassName="profile-media-row--large"
      showAllHref={showAllHref}
      title={title}
    />
  )
}

function SeriesStatusPill({ series }: { series: WatchedSeries }) {
  const { t } = useTranslation()

  if (series.is_caught_up) {
    return null
  }

  if (series.next_episode) {
    const isUpcoming = isFutureDateOnly(series.next_episode.air_date)

    return (
      <div className="mt-3 grid gap-2">
        <span className="inline-flex min-h-7 w-fit items-center rounded-full border border-kino-accent/25 bg-kino-accent/10 px-3 text-xs font-semibold text-kino-text">
          {t('profile.next')}{' '}
          {t('profile.episodeCode', {
            episode: series.next_episode.episode,
            season: series.next_episode.season,
          })}
        </span>

        {isUpcoming ? (
          <span className="inline-flex min-h-7 w-fit items-center rounded-full border border-white/10 bg-white/8 px-3 text-xs font-semibold text-kino-text">
            {series.next_episode.air_date
              ? t('profile.newEpisodesOn', {
                  date: formatDate(series.next_episode.air_date),
                })
              : t('profile.newEpisodesSoon')}
          </span>
        ) : null}
      </div>
    )
  }

  if (series.last_episode) {
    return (
      <span className="mt-3 inline-flex min-h-7 items-center rounded-full border border-white/10 bg-white/8 px-3 text-xs font-semibold text-kino-text">
        {t('profile.last')}{' '}
        {t('profile.episodeCode', {
          episode: series.last_episode.episode,
          season: series.last_episode.season,
        })}
      </span>
    )
  }

  return null
}
