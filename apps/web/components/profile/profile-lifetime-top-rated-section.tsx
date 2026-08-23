'use client'

import type { ProfileMonthlyRecapTitle } from '@kino/core'
import Link from 'next/link'
import { useMemo } from 'react'
import { Poster } from '@/components/kino'
import { RatingStars } from '@/components/media/rating-stars'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { localizedTitleKey, useLocalizedTitles } from '@/hooks/title/use-localized-titles'
import { useTranslation } from '@/lib/localization/i18n'
import { titlePath } from '@/lib/routes'
import { getTmdb } from '@/lib/services'

type LifetimeTopRatedMediaType = 'movie' | 'tv'

export function ProfileLifetimeTopRatedSection({
  error = false,
  items,
  loading = false,
  mediaType,
  onRetry,
  title,
}: {
  error?: boolean
  items: ProfileMonthlyRecapTitle[]
  loading?: boolean
  mediaType: LifetimeTopRatedMediaType
  onRetry?: () => void
  title: string
}) {
  const { t } = useTranslation()

  const localizedRequests = useMemo(
    () =>
      items.map((item) => ({
        tmdbId: item.tmdbId,
        type: mediaType,
      })),
    [items, mediaType]
  )

  const localizedTitles = useLocalizedTitles(localizedRequests)

  const rows = useMemo(
    () =>
      items.map((item, index) => {
        const localized =
          localizedTitles.data?.[
            localizedTitleKey({
              tmdbId: item.tmdbId,
              type: mediaType,
            })
          ]

        return {
          item,
          posterPath: localized?.posterPath ?? item.coverImage ?? null,
          rank: index + 1,
          title: localized?.title || item.title,
        }
      }),
    [items, localizedTitles.data, mediaType]
  )

  const pending = loading || (items.length > 0 && localizedTitles.isPending)

  return (
    <Card className="gap-0 rounded-xl border-white/10 bg-kino-surface p-0 shadow-none">
      <CardHeader className="gap-1 px-6 pt-6">
        <CardTitle className="text-lg font-bold text-kino-text">{title}</CardTitle>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-4">
        {pending ? (
          <TopRatedSkeleton />
        ) : error ? (
          <div className="grid min-h-40 place-items-center text-center">
            <div>
              <p className="text-sm text-kino-muted">{t('common.tryAgain')}</p>

              {onRetry ? (
                <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
                  {t('common.retry')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-kino-muted">{t('stats.noActivity')}</p>
        ) : (
          <ol className="grid gap-x-8 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-5">
            {rows.map(({ item, posterPath, rank, title: displayTitle }) => (
              <TopRatedRow
                item={item}
                key={item.titleId}
                mediaType={mediaType}
                posterPath={posterPath}
                rank={rank}
                title={displayTitle}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function TopRatedRow({
  item,
  mediaType,
  posterPath,
  rank,
  title,
}: {
  item: ProfileMonthlyRecapTitle
  mediaType: LifetimeTopRatedMediaType
  posterPath: string | null
  rank: number
  title: string
}) {
  const { t } = useTranslation()

  return (
    <li className="min-w-0 border-b border-white/10 last:border-b-0 `lg:nth-5:border-b-0 `lg:nth-10:border-b-0">
      <Link
        className="group grid min-w-0 grid-cols-[32px_48px_minmax(0,1fr)] items-center gap-3 py-3.5 sm:grid-cols-[36px_56px_minmax(0,1fr)_auto]"
        href={titlePath(item.tmdbId, title, mediaType)}
      >
        <div className="text-center text-lg font-bold leading-none text-kino-muted transition-colors group-hover:text-kino-text">
          <span aria-hidden="true">{rank}.</span>

          <span className="sr-only">{t('profile.rank', { rank })}</span>
        </div>

        <Poster
          className="w-12 sm:w-14"
          showHoverPresentation={false}
          sizes="56px"
          src={getTmdb().getImageUrl(posterPath, 'w200')}
          title={title}
        />

        <h3 className="min-w-0 truncate text-sm font-semibold text-kino-text transition-colors group-hover:text-kino-accent sm:text-base">
          {title}
        </h3>

        <div className="col-start-3 flex min-w-0 items-center gap-2 sm:col-auto">
          {item.rating != null ? (
            <>
              <RatingStars readonly size="sm" value={item.rating} />

              <span className="shrink-0 text-sm font-semibold text-kino-text">
                {item.rating.toFixed(1)}
              </span>
            </>
          ) : (
            <span className="text-sm text-kino-muted">—</span>
          )}
        </div>
      </Link>
    </li>
  )
}

function TopRatedSkeleton() {
  return (
    <div className="grid gap-x-8 lg:grid-cols-2">
      {Array.from({ length: 10 }, (_, index) => (
        <div
          className="grid grid-cols-[32px_48px_minmax(0,1fr)] items-center gap-3 border-b border-white/10 py-3.5 sm:grid-cols-[36px_56px_minmax(0,1fr)_auto]"
          key={`lifetime-top-rated-skeleton-${index}`}
        >
          <Skeleton className="h-5 w-6 justify-self-center" />
          <Skeleton className="aspect-2/3 w-12 sm:w-14" />
          <Skeleton className="h-4 w-2/3" />

          <div className="col-start-3 flex gap-2 sm:col-auto">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-7" />
          </div>
        </div>
      ))}
    </div>
  )
}
