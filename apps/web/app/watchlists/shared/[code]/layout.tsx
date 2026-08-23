import type { ReactNode } from 'react'
import { localizedPublicRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPublicRouteMetadata({
    canonicalPath: '/watchlists/shared',
    descriptionKey: 'metadata.watchlistsDescription',
    titleKey: 'metadata.watchlistsTitle',
  })
}

export default function SharedWatchlistLayout({ children }: { children: ReactNode }) {
  return children
}
