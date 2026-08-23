'use client'

import { formatDate, type UserWatchlistSummary } from '@kino/core'
import { Clock3, Film } from 'lucide-react'
import Link from 'next/link'
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { WatchlistPreviewPosters } from '@/components/watchlist/watchlist-preview-posters'
import { WatchlistVisibilityBadge } from '@/components/watchlist/watchlist-sharing'
import { useTranslation } from '@/lib/localization/i18n'
import { watchlistPath } from '@/lib/routes'
import {
  getWatchlistLastAddedPresentation,
  getWatchlistParticipantPreview,
} from '@/lib/watchlist/watchlist-card'

export function WatchlistCard({ watchlist }: { watchlist: UserWatchlistSummary }) {
  const { t } = useTranslation()

  const hasArtwork = watchlist.previewTitles.length > 0

  const progressPercentage =
    watchlist.titleCount > 0 ? Math.round((watchlist.watchedCount / watchlist.titleCount) * 100) : 0

  const {
    mode: participantMode,
    visibleParticipants,
    remainingCount,
  } = getWatchlistParticipantPreview(watchlist.participants)

  const lastAddedPresentation = watchlist.lastItemAddedAt
    ? getWatchlistLastAddedPresentation(watchlist.lastItemAddedAt, new Date())
    : null

  const lastAddedLabel =
    lastAddedPresentation?.kind === 'hoursAgo'
      ? t('watchlists.updatedHoursAgo', {
          count: lastAddedPresentation.hours,
          defaultValue: '{{count}} hours ago',
        })
      : lastAddedPresentation?.kind === 'lessThanHour'
        ? t('watchlists.updatedLessThanHour', {
            defaultValue: 'Less than 1 hour ago',
          })
        : lastAddedPresentation?.kind === 'date'
          ? t('watchlists.updatedOn', {
              date: lastAddedPresentation.date,
              defaultValue: 'on {{date}}',
            })
          : null

  return (
    <Link
      className="group block min-w-0 focus-ring"
      href={watchlistPath(watchlist.id, watchlist.name)}
    >
      <Card
        className="
          relative min-h-80 gap-0 overflow-hidden p-0
          transition-colors
          group-hover:border-white/20
        "
      >
        <div className="absolute inset-0">
          {hasArtwork ? (
            <WatchlistPreviewPosters titles={watchlist.previewTitles} />
          ) : (
            <div className="size-full bg-linear-to-br from-white/10 to-white/5" />
          )}
        </div>

        <div
          className="
            pointer-events-none absolute inset-0
            bg-linear-to-t
            from-black via-black/65 to-black/10
          "
        />

        <div
          className="
            relative z-10 flex min-h-80
            flex-col justify-end p-5
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <h2
                className="
                  min-w-0 truncate
                  text-xl font-semibold leading-tight text-white
                "
              >
                {watchlist.name}
              </h2>

              {participantMode === 'pair' ? (
                <div className="flex shrink-0 items-center gap-1">
                  {visibleParticipants.map((participant) => {
                    const name = participant.displayName ?? participant.username

                    return (
                      <Avatar className="ring-1 ring-white/20" key={participant.id} size="sm">
                        {participant.avatarUrl ? (
                          <AvatarImage alt={name} src={participant.avatarUrl} />
                        ) : null}

                        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )
                  })}
                </div>
              ) : null}

              {participantMode === 'group' ? (
                <AvatarGroup className="shrink-0">
                  {visibleParticipants.map((participant) => {
                    const name = participant.displayName ?? participant.username

                    return (
                      <Avatar className="ring-black/60" key={participant.id} size="sm">
                        {participant.avatarUrl ? (
                          <AvatarImage alt={name} src={participant.avatarUrl} />
                        ) : null}

                        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )
                  })}

                  <AvatarGroupCount
                    className="
                      bg-black/60 text-xs font-semibold
                      text-white ring-black/60
                      backdrop-blur-sm
                    "
                  >
                    +{remainingCount}
                  </AvatarGroupCount>
                </AvatarGroup>
              ) : null}
            </div>

            <div className="shrink-0">
              <WatchlistVisibilityBadge variant="overlay" visibility={watchlist.visibility} />
            </div>
          </div>

          {watchlist.description ? (
            <p
              className="
                mt-2 line-clamp-2
                text-sm leading-5 text-white/70
              "
            >
              {watchlist.description}
            </p>
          ) : null}

          <div className="mt-4 flex items-end gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-white/65">
                <Film aria-hidden="true" className="size-4 shrink-0" />

                <span>
                  {t('watchlists.titleCount', {
                    count: watchlist.titleCount,
                    defaultValue: '{{count}} titles',
                  })}
                </span>
              </div>

              {lastAddedLabel ? (
                <div className="flex items-center gap-2 text-xs text-white/65">
                  <Clock3 aria-hidden="true" className="size-4 shrink-0" />

                  <span className="truncate">{lastAddedLabel}</span>
                </div>
              ) : null}
            </div>

            <div
              aria-label={t('watchlists.progress.percentage', {
                defaultValue: '{{percentage}}% watched',
                percentage: progressPercentage,
              })}
              className="
                relative grid size-11 shrink-0
                place-items-center rounded-full
              "
              role="img"
              style={{
                background: `conic-gradient(
                  #1db954 ${progressPercentage * 3.6}deg,
                  rgba(255, 255, 255, 0.14) 0deg
                )`,
              }}
            >
              <div className="absolute inset-1 rounded-full bg-black/75" />

              <span
                className="
                  relative text-xs font-semibold
                  tabular-nums text-white
                "
              >
                {progressPercentage}%
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
