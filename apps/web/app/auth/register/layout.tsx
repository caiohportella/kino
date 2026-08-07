import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/auth/register',
    descriptionKey: 'metadata.siteDescription',
    titleKey: 'metadata.registerTitle',
  })
}

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children
}
