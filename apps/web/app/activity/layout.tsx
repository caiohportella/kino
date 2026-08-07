import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/activity',
    descriptionKey: 'metadata.activityDescription',
    titleKey: 'metadata.activityTitle',
  })
}

export default function ActivityLayout({ children }: { children: ReactNode }) {
  return children
}
