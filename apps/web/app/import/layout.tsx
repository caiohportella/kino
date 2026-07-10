import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Import History',
  description: 'Review and manage imported watch history in Kino.',
  alternates: {
    canonical: absoluteUrl('/import'),
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    title: 'Import History | Kino',
    type: 'website',
    url: absoluteUrl('/import'),
  },
  twitter: {
    card: 'summary_large_image',
    description: SITE_DESCRIPTION,
    title: 'Import History | Kino',
  },
}

export default function ImportLayout({ children }: { children: ReactNode }) {
  return children
}
