'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { DiscoverFriendActivityCard } from '@/components/discover/discover-friend-activity-card'
import { MediaRow } from '@/components/media/media-row'
import { useActivityFeed } from '@/hooks/activity/use-activity-feed'
import { localizedTitleKey, useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import { buildDiscoverFriendsActivity } from '@/lib/discover/friends-activity'
import { useLocale, useTranslation } from '@/lib/localization/i18n'
import { getTmdb } from '@/lib/services'
import { useAuthStore } from '@/stores/auth-store'

export function DiscoverFriendsActivity() {
  const { t } = useTranslation()
  const { locale, region } = useLocale()

  const user = useAuthStore((state) => state.user)

  const viewerId = user?.id ?? null

  const feed = useActivityFeed(viewerId, 'following', locale, region, Boolean(viewerId))

  const items = useMemo(() => buildDiscoverFriendsActivity(feed.items, 12), [feed.items])

  const localizedRequests = useMemo(
    () =>
      items.map((item) => ({
        tmdbId: item.latestActivity.subject.tmdbId,
        type: item.latestActivity.subject.mediaType,
      })),
    [items]
  )

  const localizedTitles = useLocalizedTitles(localizedRequests)

  /*
   * Discover should never reserve an empty
   * social section for logged-out users.
   */
  if (!viewerId) {
    return null
  }

  if (
    !feed.isLoading &&
    !localizedTitles.isPending &&
    (feed.isError || localizedTitles.isError || items.length === 0)
  ) {
    return null
  }

  if (feed.isLoading || localizedTitles.isPending) {
    return <FriendsActivitySkeleton />
  }

  return (
    <section className="mb-12 min-w-0 lg:mb-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-kino-text lg:text-2xl">
            {t('discover.friends.title', {
              defaultValue: 'What your friends have been watching',
            })}
          </h2>

          <p className="mt-1 text-sm text-kino-muted">
            {t('discover.friends.description', {
              defaultValue: 'Recent activity from people you follow',
            })}
          </p>
        </div>

        <Link
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md text-xs font-medium text-kino-muted transition-colors hover:text-kino-text"
          href="/activity"
        >
          {t('discover.friends.allActivity', {
            defaultValue: 'All activity',
          })}

          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>

      <MediaRow
        aria-label={t('discover.friends.title', {
          defaultValue: 'What your friends have been watching',
        })}
        className="media-row--comfortable"
        overflowAware
      >
        {items.map((item) => {
          const subject = item.latestActivity.subject

          const localized =
            localizedTitles.data[
              localizedTitleKey({
                tmdbId: subject.tmdbId,
                type: subject.mediaType,
              })
            ]

          const title = localized?.title ?? subject.name

          const posterUrl = localized
            ? getTmdb().getImageUrl(localized.posterPath, 'w300')
            : subject.posterUrl

          return (
            <DiscoverFriendActivityCard
              item={item}
              key={item.identity}
              posterUrl={posterUrl}
              title={title}
            />
          )
        })}
      </MediaRow>
    </section>
  )
}

function FriendsActivitySkeleton() {
  return (
    <section aria-hidden="true" className="mb-12 min-w-0 lg:mb-14">
      <div className="mb-5">
        <div className="h-6 w-72 animate-pulse rounded bg-white/6" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-white/5" />
      </div>

      <MediaRow className="media-row--comfortable">
        {Array.from({
          length: 6,
        }).map((_, index) => (
          <div className="w-39 shrink-0 sm:w-40" key={index}>
            <div className="aspect-2/3 animate-pulse rounded-md bg-white/6" />

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="h-3 w-14 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}
      </MediaRow>
    </section>
  )
}
