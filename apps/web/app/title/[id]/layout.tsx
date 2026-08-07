import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { cache, type ReactNode } from 'react'
import { isCanonicalResourceSegment, parseResourceSegment, titlePath } from '@/lib/routes'
import { absoluteUrl, buildTitleSchema, getTitlePresentation, socialImage } from '@/lib/seo'
import { getServerMetadataContext, pageMetadata } from '@/lib/server-metadata'
import { getTitleSeoDataBySegment } from '@/lib/server-tmdb'
import { socialMetadataText } from '@/lib/text'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { language, locale, t } = await getServerMetadataContext()
  const segment = parseResourceSegment(id)
  const tmdbId = segment.id

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return {
      ...pageMetadata({
        canonical: absoluteUrl(`/title/${id}`),
        description: t('metadata.siteDescription'),
        index: false,
        locale,
        title: t('metadata.titleNotFound'),
      }),
    }
  }

  try {
    const details = await getTitleSeoDataBySegment(tmdbId, segment.slug, language)
    const presentation = getTitlePresentation(details)
    const pageTitle = socialMetadataText(presentation.title)
    const description = socialMetadataText(
      details.synopsis || t('metadata.titleDescription', { title: pageTitle })
    )
    const canonicalPath = titlePath(tmdbId, details.title, details.type)
    const canonical = absoluteUrl(canonicalPath)
    const canonicalRoute = canonicalPath.split('?')[0]
    const image = socialImage(
      `${canonicalRoute}/opengraph-image?type=${details.type}`,
      `${pageTitle} on Kino`
    )

    return pageMetadata({
      canonical,
      description,
      image,
      index: true,
      locale,
      title: pageTitle,
    })
  } catch {
    const fallbackTitle = t('metadata.titleNotFound')
    return pageMetadata({
      canonical: absoluteUrl(`/title/${tmdbId}`),
      description: t('metadata.siteDescription'),
      index: false,
      locale,
      title: fallbackTitle,
    })
  }
}

const getTitleJsonLd = cache(async (tmdbId: number, slug: string) => {
  const details = await getTitleSeoDataBySegment(tmdbId, slug)
  return buildTitleSchema({
    details,
    url: absoluteUrl(titlePath(tmdbId, details.title, details.type)),
  })
})

export default async function TitleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const segment = parseResourceSegment(id)
  const tmdbId = segment.id

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return children
  }

  const details = await getTitleSeoDataBySegment(tmdbId, segment.slug)
  const canonicalPath = titlePath(tmdbId, details.title, details.type)
  if (!isCanonicalResourceSegment(id, tmdbId, details.title)) permanentRedirect(canonicalPath)
  const jsonLd = await getTitleJsonLd(tmdbId, segment.slug)
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: safeJsonLd }} type="application/ld+json" />
      {children}
    </>
  )
}
