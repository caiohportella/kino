import type { ReactNode } from 'react'
import { localizedPrivateRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPrivateRouteMetadata({
    canonicalPath: '/import',
    descriptionKey: 'metadata.importDescription',
    titleKey: 'metadata.importTitle',
  })
}

export default function ImportLayout({ children }: { children: ReactNode }) {
  return children
}
