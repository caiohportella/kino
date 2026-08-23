import type { ReactNode } from 'react'
import { localizedPrivateRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPrivateRouteMetadata({
    canonicalPath: '/watchlists',
    descriptionKey: 'metadata.watchlistsDescription',
    imagePath: { alt: 'metadata.watchlistsTitle', path: '/watchlists/opengraph-image' },
    titleKey: 'metadata.watchlistsTitle',
  })
}

export default function WatchlistsLayout({ children }: { children: ReactNode }) {
  return children
}
