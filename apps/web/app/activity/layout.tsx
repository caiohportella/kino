import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { absoluteUrl, SITE_NAME } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Activity',
  description: 'Your personal Kino diary and review timeline.',
  alternates: {
    canonical: absoluteUrl('/activity'),
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    description: 'Your personal Kino diary and review timeline.',
    siteName: SITE_NAME,
    title: 'Activity | Kino',
    type: 'website',
    url: absoluteUrl('/activity'),
  },
  twitter: {
    card: 'summary_large_image',
    description: 'Your personal Kino diary and review timeline.',
    title: 'Activity | Kino',
  },
}

export default function ActivityLayout({ children }: { children: ReactNode }) {
  return children
}
