import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Watchlists',
  description: 'Create, manage, and share movie and TV watchlists in Kino.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function WatchlistsLayout({ children }: { children: ReactNode }) {
  return children
}
