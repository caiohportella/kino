import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Create account',
  description: SITE_DESCRIPTION,
  robots: {
    index: false,
    follow: false,
  },
}

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children
}
