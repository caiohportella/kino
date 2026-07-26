import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Shared watchlist',
  robots: { index: false, follow: false },
}

export default function SharedWatchlistLayout({ children }: { children: ReactNode }) {
  return children
}
