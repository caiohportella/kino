import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/watchlists',
    descriptionKey: 'metadata.watchlistsDescription',
    imagePath: { alt: 'metadata.watchlistsTitle', path: '/watchlists/opengraph-image' },
    titleKey: 'metadata.watchlistsTitle',
  })
}

export default function WatchlistsLayout({ children }: { children: ReactNode }) {
  return children
}
