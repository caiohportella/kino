'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EmptyState, Poster } from '@/components/kino'
import { PageHeader } from '@/components/layout/page-header'
import { WatchlistsSkeleton } from '@/components/skeletons/page-skeletons'
import { useTranslation } from '@/lib/i18n'
import { resolveLocalizedTitlePresentation } from '@/lib/localized-title-presentation'
import { titlePath } from '@/lib/routes'
import { db, getTmdb } from '@/lib/services'
import { useLocalizedTitles } from '@/lib/use-localized-titles'

export default function SharedWatchlistPage() {
  const { code } = useParams<{ code: string }>()
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['shared-watchlist', code],
    queryFn: () => db.getSharedWatchlistByCode(code),
    retry: false,
  })
  const localizedTitles = useLocalizedTitles(
    (query.data?.items || []).map((item) => ({
      tmdbId: item.title.tmdb_id,
      type: item.title.type,
    }))
  )

  if (query.isPending || localizedTitles.isPending)
    return <WatchlistsSkeleton detail label={t('watchlists.loadingWatchlist')} />
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
          {query.data.items.map((item) => {
            const localizedTitle = resolveLocalizedTitlePresentation({
              ...localizedTitles,
              request: { tmdbId: item.title.tmdb_id, type: item.title.type },
              unknownTitle: t('diary.unknownTitle'),
            })
            if (localizedTitle.status !== 'ready') {
              return (
                <article className="grid min-w-0 content-start gap-3" key={item.id}>
                  <div className="grid aspect-2/3 place-items-center rounded-lg border border-white/10 bg-kino-surface px-4 text-center text-xs font-semibold text-kino-muted">
                    {t('watchlists.titleUnavailable')}
                  </div>
                  <h2 className="line-clamp-2 h-10 text-sm font-semibold leading-5 text-kino-muted">
                    {t('watchlists.titleUnavailable')}
                  </h2>
                </article>
              )
            }
            return (
              <Link
                className="group min-w-0 focus-ring"
                href={titlePath(item.title.tmdb_id, localizedTitle.title, item.title.type)}
                key={item.id}
              >
                <Poster
                  className="rounded-lg shadow-soft"
                  details={{
                    year: localizedTitle.year ?? item.title.release_year,
                  }}
                  src={getTmdb().getImageUrl(localizedTitle.posterPath, 'w300')}
                  title={localizedTitle.title}
                />
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState body={t('watchlists.emptyListHint')} title={t('watchlists.emptyList')} />
      )}
    </div>
  )
}
