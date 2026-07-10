import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_NAME, absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Discover',
  description: 'Browse trending movies, popular TV series, new releases, and top-rated picks in Kino.',
  alternates: {
    canonical: absoluteUrl('/discover'),
  },
  openGraph: {
    description: 'Browse trending movies, popular TV series, new releases, and top-rated picks in Kino.',
    siteName: SITE_NAME,
    title: 'Discover | Kino',
    type: 'website',
    url: absoluteUrl('/discover'),
  },
  twitter: {
    card: 'summary_large_image',
    description: 'Browse trending movies, popular TV series, new releases, and top-rated picks in Kino.',
    title: 'Discover | Kino',
  },
}

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children
}
