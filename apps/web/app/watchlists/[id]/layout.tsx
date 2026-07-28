import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { parseWatchlistSegment, watchlistPath } from '@/lib/routes'
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, socialImage, trimText } from '@/lib/seo'
import { getPublicWatchlistOgData } from '@/lib/server-supabase'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id: segment } = await params
  const { id } = parseWatchlistSegment(segment)

  try {
    const watchlist = await getPublicWatchlistOgData(id)
    if (!watchlist) return unavailableMetadata()

    const title = trimText(watchlist.name, 70)
    const featured = watchlist.titles.slice(0, 3).map((item) => item.title)
    const description = watchlist.description
      ? trimText(watchlist.description, 160)
      : featured.length
        ? trimText(`Explore a curated collection including ${featured.join(', ')} and more.`, 160)
        : 'Explore a public movie and series collection curated on Kino.'
    const canonical = absoluteUrl(watchlistPath(id, watchlist.name))
    const image = socialImage(
      `/api/og/watchlist/${id}`,
      `${watchlist.name} — public Kino watchlist`
    )

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
      twitter: { card: 'summary_large_image', description, images: [image], title },
    }
  } catch {
    return unavailableMetadata()
  }
}

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return children
}

function unavailableMetadata(): Metadata {
  return {
    title: 'Watchlist unavailable',
    description: SITE_DESCRIPTION,
    robots: { index: false, follow: false },
  }
}
