import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/auth/login',
    descriptionKey: 'metadata.siteDescription',
    titleKey: 'metadata.loginTitle',
  })
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
