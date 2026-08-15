import type { Metadata } from 'next'
import { HttpErrorState } from '@/components/error-state'
import { SITE_NAME, socialImage } from '@/lib/seo'
import { getServerMetadataContext } from '@/lib/server-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getServerMetadataContext()
  const title = t('errors.404.title')
  const description = t('metadata.siteDescription')
  const image = socialImage('/api/og/fallback', title)

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      description,
      images: [image],
      locale,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      description,
      images: [image],
      title: `${title} | ${SITE_NAME}`,
    },
  }
}

export default function NotFound() {
  return <HttpErrorState status={404} />
}
