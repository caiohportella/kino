import type { Metadata } from 'next'
import { PublicLanding } from '@/components/public-landing'
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, buildSoftwareApplicationSchema, buildWebsiteSchema } from '@/lib/seo'

export const metadata: Metadata = {
  alternates: {
    canonical: absoluteUrl('/'),
  },
  description: SITE_DESCRIPTION,
  title: {
    absolute: SITE_NAME,
  },
  openGraph: {
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    title: SITE_NAME,
    type: 'website',
    url: absoluteUrl('/'),
  },
  twitter: {
    card: 'summary_large_image',
    description: SITE_DESCRIPTION,
    title: SITE_NAME,
  },
}

export default function HomePage() {
  const websiteJsonLd = JSON.stringify(buildWebsiteSchema()).replace(/</g, '\\u003c')
  const appJsonLd = JSON.stringify(buildSoftwareApplicationSchema()).replace(/</g, '\\u003c')

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: websiteJsonLd }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: appJsonLd }} type="application/ld+json" />
      <PublicLanding />
    </>
  )
}
