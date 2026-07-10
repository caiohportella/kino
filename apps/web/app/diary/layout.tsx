import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Diary',
  description: 'Private watch diary and review history for Kino.',
  alternates: {
    canonical: absoluteUrl('/diary'),
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    title: 'Diary | Kino',
    type: 'website',
    url: absoluteUrl('/diary'),
  },
  twitter: {
    card: 'summary_large_image',
    description: SITE_DESCRIPTION,
    title: 'Diary | Kino',
  },
}

export default function DiaryLayout({ children }: { children: ReactNode }) {
  return children
}
