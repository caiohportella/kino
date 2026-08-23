import type { ReactNode } from 'react'
import { localizedPrivateRouteMetadata } from '@/lib/seo/server-metadata'

export async function generateMetadata() {
  return localizedPrivateRouteMetadata({
    canonicalPath: '/diary',
    descriptionKey: 'metadata.diaryDescription',
    titleKey: 'metadata.diaryTitle',
  })
}

export default function DiaryLayout({ children }: { children: ReactNode }) {
  return children
}
