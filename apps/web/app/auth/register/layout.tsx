import type { ReactNode } from 'react'
import { localizedPublicRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPublicRouteMetadata({
    canonicalPath: '/auth/register',
    descriptionKey: 'metadata.siteDescription',
    titleKey: 'metadata.registerTitle',
  })
}

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children
}
