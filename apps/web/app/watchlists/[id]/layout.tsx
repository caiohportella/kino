import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, socialImage, trimText } from '@/lib/seo'
import { getPublicWatchlistOgData } from '@/lib/server-supabase'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params

  try {
    const watchlist = await getPublicWatchlistOgData(id)
    if (!watchlist) return privateWatchlistMetadata()

    const title = trimText(watchlist.name, 70)
    const description = watchlist.description
      ? trimText(watchlist.description, 160)
      : 'A shared movie and series watchlist curated on Kino.'
    const canonical = absoluteUrl(`/watchlists/${id}`)
    const image = socialImage(`/api/og/watchlist/${id}`, `${watchlist.name} — shared Kino watchlist`)

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        description,
        images: [image],
        siteName: SITE_NAME,
        title,
        type: 'website',
        url: canonical,
      },
      robots: { index: true, follow: true },
      twitter: {
        card: 'summary_large_image',
        description,
        images: [image],
        title,
      },
    }
  } catch {
    return privateWatchlistMetadata()
  }
}

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return children
}

function privateWatchlistMetadata(): Metadata {
  const image = socialImage('/api/og/fallback', 'Kino — private or unavailable watchlist')
  return {
    title: 'Watchlist unavailable',
    description: SITE_DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: {
      description: SITE_DESCRIPTION,
      images: [image],
      siteName: SITE_NAME,
      title: 'Watchlist unavailable',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      description: SITE_DESCRIPTION,
      images: [image],
      title: 'Watchlist unavailable',
    },
  }
}
