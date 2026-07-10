import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your Kino profile and public viewing activity.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children
}
