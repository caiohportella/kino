import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/watchlists/shared',
    descriptionKey: 'metadata.watchlistsDescription',
    titleKey: 'metadata.watchlistsTitle',
  })
}

export default function SharedWatchlistLayout({ children }: { children: ReactNode }) {
  return children
}
