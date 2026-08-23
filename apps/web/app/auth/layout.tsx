import type { ReactNode } from 'react'
import { localizedPrivateRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPrivateRouteMetadata({
    canonicalPath: '/auth',
    descriptionKey: 'metadata.siteDescription',
    titleKey: 'metadata.accountTitle',
  })
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
