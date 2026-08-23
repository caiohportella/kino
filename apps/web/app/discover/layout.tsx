import type { ReactNode } from 'react'
import { localizedPublicRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPublicRouteMetadata({
    canonicalPath: '/discover',
    descriptionKey: 'metadata.discoverDescription',
    imagePath: { alt: 'metadata.discoverTitle', path: '/discover/opengraph-image' },
    titleKey: 'metadata.discoverTitle',
  })
}

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children
}
