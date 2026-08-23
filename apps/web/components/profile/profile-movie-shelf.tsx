'use client'

import type { WatchedMovie } from '@kino/core'
import Link from 'next/link'
import { Poster } from '@/components/kino'
import { ProfileShelfError, ProfileShelfSkeleton } from '@/components/profile/profile-shelf-state'
import { ProfileTitleRow } from '@/components/profile/profile-title-row'
import { localizedTitleKey, useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import { useTranslation } from '@/lib/localization/i18n'
import { profileMoviesPath, titlePath } from '@/lib/routes'
import { getTmdb } from '@/lib/services'

export type ProfileMovieShelfProps = {
  items: WatchedMovie[]
  title: string
  username: string
}

export function ProfileMovieShelf({ items, title, username }: ProfileMovieShelfProps) {
  const { t } = useTranslation()

  const localizedTitles = useLocalizedTitles(
    items.slice(0, 15).map((item) => ({
      tmdbId: item.tmdb_id,
      type: 'movie' as const,
    }))
  )

  if (items.length === 0) {
    return null
  }

  if (localizedTitles.isPending) {
    return <ProfileShelfSkeleton title={title} />
  }

  if (localizedTitles.isError) {
    return <ProfileShelfError title={title} />
  }

  const renderTitleCard = (item: WatchedMovie) => {
    const localized =
      localizedTitles.data?.[
        localizedTitleKey({
          tmdbId: item.tmdb_id,
          type: 'movie',
        })
      ]

    const displayTitle = localized?.title || t('diary.unknownTitle')

    const posterPath = localized?.posterPath ?? null

    const releaseYear = localized?.year ?? item.release_year

    return (
      <Link
        className="group min-w-0 focus-ring"
        href={titlePath(item.tmdb_id, displayTitle, 'movie')}
        key={item.id}
      >
        <Poster
          className="w-full rounded-md"
          details={{
            completed: true,
            year: releaseYear,
          }}
          src={getTmdb().getImageUrl(posterPath, 'w300')}
          title={displayTitle}
        />
      </Link>
    )
  }

  return (
    <ProfileTitleRow
      items={items}
      previewLimit={15}
      renderTitleCard={renderTitleCard}
      rowClassName="profile-media-row--large"
      showAllHref={profileMoviesPath(username)}
      title={title}
    />
  )
}
