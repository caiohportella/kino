import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/search',
    descriptionKey: 'metadata.searchDescription',
    titleKey: 'metadata.searchTitle',
  })
}

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children
}
