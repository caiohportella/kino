import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Edit your Kino profile, language, and account settings.',
  alternates: {
    canonical: absoluteUrl('/settings'),
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children
}
