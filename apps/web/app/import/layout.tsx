import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/import',
    descriptionKey: 'metadata.importDescription',
    titleKey: 'metadata.importTitle',
  })
}

export default function ImportLayout({ children }: { children: ReactNode }) {
  return children
}
