import type { ReactNode } from 'react'
import { localizedPublicRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPublicRouteMetadata({
    canonicalPath: '/auth/login',
    descriptionKey: 'metadata.siteDescription',
    titleKey: 'metadata.loginTitle',
  })
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
