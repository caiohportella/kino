import type { Metadata } from 'next'
import { HttpErrorState } from '@/components/error-state'
import { SITE_DESCRIPTION, SITE_NAME, socialImage } from '@/lib/seo'

const image = socialImage('/api/og/fallback', 'Kino — page not found')

export const metadata: Metadata = {
  title: 'Page not found',
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    description: SITE_DESCRIPTION,
    images: [image],
    siteName: SITE_NAME,
    title: 'Page not found',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    description: SITE_DESCRIPTION,
    images: [image],
    title: 'Page not found',
  },
}

export default function NotFound() {
  return <HttpErrorState status={404} />
}
