'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EmptyState, Poster } from '@/components/kino'
import { PageHeader } from '@/components/page-header'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { useTranslation } from '@/lib/i18n'
import { titlePath } from '@/lib/routes'
import { db, getTmdb } from '@/lib/services'

export default function SharedWatchlistPage() {
  const { code } = useParams<{ code: string }>()
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['shared-watchlist', code],
    queryFn: () => db.getSharedWatchlistByCode(code),
    retry: false,
  })

  if (query.isLoading) return <WatchlistsSkeleton detail label={t('watchlists.loadingWatchlist')} />
  if (!query.data) {
    return (
      <EmptyState
        body={t('watchlists.notFoundBody')}
        title={t('watchlists.notFound')}
        variant="missing"
      />
    )
  }

  return (
    <div className="content-frame">
      <PageHeader
        body={query.data.watchlist.description || t('watchlists.defaultDescription')}
        eyebrow={t('watchlists.sharedWatchlist')}
        title={query.data.watchlist.name}
      />
      {query.data.items.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-x-5 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
          {query.data.items.map((item) => (
            <Link
              className="grid min-w-0 content-start gap-3"
              href={titlePath(item.title.tmdb_id, item.title.title, item.title.type)}
              key={item.id}
            >
              <Poster
                className="rounded-lg shadow-soft"
                src={getTmdb().getImageUrl(item.title.cover_image, 'w300')}
                title={item.title.title}
              />
              <h2 className="line-clamp-2 text-sm font-semibold text-kino-text">
                {item.title.title}
              </h2>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState body={t('watchlists.emptyListHint')} title={t('watchlists.emptyList')} />
      )}
    </div>
  )
}
