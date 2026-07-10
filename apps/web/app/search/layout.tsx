import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_NAME, absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search movies and TV series by title, genre, and rating in Kino.',
  alternates: {
    canonical: absoluteUrl('/search'),
  },
  openGraph: {
    description: 'Search movies and TV series by title, genre, and rating in Kino.',
    siteName: SITE_NAME,
    title: 'Search | Kino',
    type: 'website',
    url: absoluteUrl('/search'),
  },
  twitter: {
    card: 'summary_large_image',
    description: 'Search movies and TV series by title, genre, and rating in Kino.',
    title: 'Search | Kino',
  },
}

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children
}
