import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_NAME, absoluteUrl, socialImage } from '@/lib/seo'

const description = 'Create, manage, and share movie and TV watchlists in Kino.'
const image = socialImage(
  '/watchlists/opengraph-image',
  'Create and share watchlists on Kino',
)

export const metadata: Metadata = {
  title: 'Watchlists',
  description,
  alternates: {
    canonical: absoluteUrl('/watchlists'),
  },
  openGraph: {
    description,
    images: [image],
    siteName: SITE_NAME,
    title: 'Watchlists | Kino',
    type: 'website',
    url: absoluteUrl('/watchlists'),
  },
  twitter: {
    card: 'summary_large_image',
    description,
    images: [image],
    title: 'Watchlists | Kino',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function WatchlistsLayout({ children }: { children: ReactNode }) {
  return children
}
