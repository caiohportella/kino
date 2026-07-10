import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Account',
  description: SITE_DESCRIPTION,
  robots: {
    index: false,
    follow: false,
  },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
