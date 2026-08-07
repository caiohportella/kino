import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/discover',
    descriptionKey: 'metadata.discoverDescription',
    imagePath: { alt: 'metadata.discoverTitle', path: '/discover/opengraph-image' },
    titleKey: 'metadata.discoverTitle',
  })
}

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children
}
