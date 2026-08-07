import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PublicLanding } from '@/components/public-landing'
import {
  absoluteUrl,
  buildSoftwareApplicationSchema,
  buildWebsiteSchema,
  SITE_NAME,
} from '@/lib/seo'
import { getServerMetadataContext } from '@/lib/server-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getServerMetadataContext()
  const description = t('metadata.siteDescription')
  return {
    alternates: {
      canonical: absoluteUrl('/'),
    },
    description,
    title: {
      absolute: SITE_NAME,
    },
    openGraph: {
      description,
      locale,
      siteName: SITE_NAME,
      title: SITE_NAME,
      type: 'website',
      url: absoluteUrl('/'),
    },
    twitter: {
      card: 'summary_large_image',
      description,
      title: SITE_NAME,
    },
  }
}

export default async function HomePage() {
  const websiteJsonLd = JSON.stringify(buildWebsiteSchema()).replace(/</g, '\\u003c')
  const appJsonLd = JSON.stringify(buildSoftwareApplicationSchema()).replace(/</g, '\\u003c')

  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/discover')
  }

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: websiteJsonLd }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: appJsonLd }} type="application/ld+json" />
      <PublicLanding />
    </>
  )
}
