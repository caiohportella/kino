import type { ReactNode } from 'react'
import { localizedRouteMetadata } from '@/lib/server-metadata'

export async function generateMetadata() {
  return localizedRouteMetadata({
    canonicalPath: '/diary',
    descriptionKey: 'metadata.diaryDescription',
    titleKey: 'metadata.diaryTitle',
  })
}

export default function DiaryLayout({ children }: { children: ReactNode }) {
  return children
}
