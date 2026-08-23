'use client'

import type { PublicWatchlistSummary } from '@kino/core'
import Link from 'next/link'
import { Poster } from '@/components/kino'
import { ProfileTitleRow } from '@/components/profile/profile-title-row'
import { useTranslation } from '@/lib/localization/i18n'
import { watchlistCoverPath, watchlistPath } from '@/lib/routes'

export type ProfileWatchlistShelfProps = {
  items: PublicWatchlistSummary[]
}

export function ProfileWatchlistShelf({ items }: ProfileWatchlistShelfProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return null
  }

  const renderWatchlistCard = (watchlist: PublicWatchlistSummary) => (
    <Link
      className="group grid min-w-0 content-start gap-3 focus-ring"
      href={watchlistPath(watchlist.id, watchlist.name)}
      key={watchlist.id}
    >
      <Poster
        alt={watchlist.name}
        className="w-full rounded-md"
        src={watchlistCoverPath(watchlist.id, watchlist.coverVersion)}
        title={watchlist.name}
      />
    </Link>
  )

  return (
    <ProfileTitleRow
      items={items}
      renderTitleCard={renderWatchlistCard}
      title={t('watchlists.title')}
    />
  )
}
