'use client'

import Link from 'next/link'
import { Poster } from '@/components/kino'
import { MediaRow } from '@/components/media/media-row'
import { useMediaPoster } from '@/hooks/title/use-media-poster'
import { formatLocalizedDate } from '@/lib/date'
import type { DiscoverSeriesUpdateItem } from '@/lib/discover/series-updates'
import { useLocale, useTranslation } from '@/lib/localization/i18n'

export function DiscoverUpdatesSection({ items }: { items: DiscoverSeriesUpdateItem[] }) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return null
  }

  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-kino-text">
          {t('home.updatesForYou', {
            defaultValue: 'Updates for you',
          })}
        </h2>
      </div>

      <MediaRow>
        {items.map((item) => (
          <DiscoverUpdateCard
            item={item}
            key={`${item.update.kind}-${item.update.tmdbId}-${item.update.airDate}`}
          />
        ))}
      </MediaRow>
    </section>
  )
}

function DiscoverUpdateCard({ item }: { item: DiscoverSeriesUpdateItem }) {
  const { t } = useTranslation()
  const { locale } = useLocale()

  const { href, poster, prefetch, title, year } = useMediaPoster(item.title)

  const { update } = item

  const date = formatLocalizedDate(update.airDate, locale, {
    day: 'numeric',
    month: 'short',
  })

  const badge =
    update.kind === 'episode'
      ? t('home.newEpisode', {
          defaultValue: 'New episode',
        })
      : t('home.newSeason', {
          defaultValue: 'New season',
        })

  const detail =
    update.kind === 'episode'
      ? `${t('home.episodeShort', {
          defaultValue: 'S{{season}}E{{episode}}',
          season: update.season,
          episode: update.episode ?? '',
        })} · ${t('home.availableNow', {
          defaultValue: 'Available now',
        })}`
      : `${t('home.seasonNumber', {
          defaultValue: 'Season {{season}}',
          season: update.season,
        })} · ${date}`

  return (
    <Link
      className="group min-w-0 focus-ring"
      href={href}
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      <Poster className="w-full rounded-md" details={{ year }} src={poster} title={title} />

      <div className="mt-2.5 min-w-0">
        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-kino-accent">
          {badge}
        </span>

        <div className="mt-1.5 truncate text-sm font-semibold text-kino-text">{title}</div>

        <div className="mt-0.5 truncate text-xs text-kino-muted">{detail}</div>
      </div>
    </Link>
  )
}
