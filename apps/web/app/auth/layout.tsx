import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/auth',
    descriptionKey: 'metadata.siteDescription',
    titleKey: 'metadata.accountTitle',
  })
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
