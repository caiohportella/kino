import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Sign in',
  description: SITE_DESCRIPTION,
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
