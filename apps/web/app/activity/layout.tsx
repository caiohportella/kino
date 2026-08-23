import type { ReactNode } from 'react'
import { localizedPrivateRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPrivateRouteMetadata({
    canonicalPath: '/activity',
    descriptionKey: 'metadata.activityDescription',
    titleKey: 'metadata.activityTitle',
  })
}

export default function ActivityLayout({ children }: { children: ReactNode }) {
  return children
}
