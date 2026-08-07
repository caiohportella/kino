import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/settings',
    descriptionKey: 'metadata.settingsDescription',
    titleKey: 'metadata.settingsTitle',
  })
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children
}
