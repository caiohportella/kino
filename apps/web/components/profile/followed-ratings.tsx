'use client'

import type { FollowedRating } from '@kino/core'
import Link from 'next/link'
import { RatingStars } from '@/components/media/rating-stars'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useFollowedTitleRatings } from '@/hooks/title/use-followed-ratings'
import { useTranslation } from '@/lib/localization/i18n'

function RatingRow({ item, compact = false }: { item: FollowedRating; compact?: boolean }) {
  const name = item.user.displayName || item.user.username || 'Kino user'
  const href = item.user.username ? `/${encodeURIComponent(item.user.username)}` : '#'
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link className="focus-ring rounded-full" href={href}>
        <Avatar size="sm">
          {item.user.avatarUrl ? (
            <AvatarImage alt={`${name}'s avatar`} src={item.user.avatarUrl} />
          ) : null}
          <AvatarFallback aria-hidden="true">{name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>
      {!compact ? (
        <Link
          className="focus-ring min-w-0 flex-1 truncate rounded-sm text-sm font-medium text-kino-text hover:text-kino-accent"
          href={href}
        >
          {name}
        </Link>
      ) : null}
      <RatingStars label={`${name} rating`} readonly size="sm" value={item.rating} />
    </div>
  )
}

function isRenderableFollowedRating(item: FollowedRating): item is FollowedRating {
  return Boolean(item?.user?.id) && Number.isFinite(item?.rating)
}

export function FollowedTitleRatings({ titleId, enabled }: { titleId: string; enabled: boolean }) {
  const { t } = useTranslation()
  const query = useFollowedTitleRatings(titleId, enabled)
  if (!enabled || (!query.isLoading && !query.data?.items.length)) return null

  return (
    <section className="mt-4 border-t border-white/8 pt-4">
      <h3 className="mb-3 text-sm font-semibold text-kino-text">
        {t('reviews.fromPeopleYouFollow')}
      </h3>
      <div className="grid gap-2.5">
        {query.isLoading
          ? [0, 1].map((item) => (
              <div className="flex items-center gap-2" key={item}>
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))
          : query.data?.items.map((item) => <RatingRow item={item} key={item.user.id} />)}
      </div>
    </section>
  )
}

export function FollowedEpisodeRatingRows({
  items,
  totalCount,
}: {
  items: FollowedRating[]
  totalCount: number
}) {
  const renderableItems = items.filter(isRenderableFollowedRating)
  const renderableTotal = Math.max(totalCount, renderableItems.length)
  if (!renderableItems.length) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {renderableItems.slice(0, 2).map((item) => (
        <RatingRow compact item={item} key={item.user.id} />
      ))}
      {renderableTotal > 2 ? (
        <span className="text-xs text-kino-muted">+{renderableTotal - 2}</span>
      ) : null}
    </div>
  )
}
