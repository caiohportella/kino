import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { parseWatchlistSegment, watchlistPath } from '@/lib/routes'
import { absoluteUrl, socialImage, trimText } from '@/lib/seo'
import { getServerMetadataContext, pageMetadata } from '@/lib/server-metadata'
import { getPublicWatchlistOgData } from '@/lib/server-supabase'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id: segment } = await params
  const { locale, t } = await getServerMetadataContext()
  const { id } = parseWatchlistSegment(segment)

  try {
    const watchlist = await getPublicWatchlistOgData(id)
    if (!watchlist) {
      return pageMetadata({
        canonical: absoluteUrl('/watchlists'),
        description: t('metadata.siteDescription'),
        index: false,
        locale,
        title: t('metadata.watchlistUnavailable'),
      })
    }

    const title = trimText(watchlist.name, 70)
    const featured = watchlist.titles.slice(0, 3).map((item) => item.title)
    const description = watchlist.description
      ? trimText(watchlist.description, 160)
      : featured.length
        ? trimText(t('metadata.watchlistDescription', { titles: featured.join(', ') }), 160)
        : t('metadata.watchlistEmptyDescription')
    const canonical = absoluteUrl(watchlistPath(id, watchlist.name))
    const image = socialImage(
      `/api/og/watchlist/${id}`,
      `${watchlist.name} — public Kino watchlist`
    )

    return pageMetadata({ canonical, description, image, index: true, locale, title })
  } catch {
    return pageMetadata({
      canonical: absoluteUrl('/watchlists'),
      description: t('metadata.siteDescription'),
      index: false,
      locale,
      title: t('metadata.watchlistUnavailable'),
    })
  }
}

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return children
}
