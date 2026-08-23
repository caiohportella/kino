import type { ReactNode } from 'react'
import { localizedPrivateRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPrivateRouteMetadata({
    canonicalPath: '/search',
    descriptionKey: 'metadata.searchDescription',
    titleKey: 'metadata.searchTitle',
  })
}

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children
}
