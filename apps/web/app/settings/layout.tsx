import type { ReactNode } from 'react'
import { localizedPrivateRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPrivateRouteMetadata({
    canonicalPath: '/settings',
    descriptionKey: 'metadata.settingsDescription',
    titleKey: 'metadata.settingsTitle',
  })
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children
}
