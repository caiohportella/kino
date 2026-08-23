import type { MediaType } from '@kino/core'
import type { Metadata } from 'next'
import { TitlePage } from '@/components/title/title-page'
import { parseResourceSegment, titlePath } from '@/lib/routes'
import {
  absoluteUrl,
  buildTitleDescription,
  buildTitleSchema,
  getTitlePresentation,
  SITE_DESCRIPTION,
  SITE_NAME,
  socialImage,
} from '@/lib/seo/seo'
import { getServerMetadataContext } from '@/lib/seo/server-metadata'
import { socialMetadataText } from '@/lib/text'
import { getTitleSeoData } from '@/lib/tmdb/server-tmdb'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    type?: string | string[]
  }>
}

function resolveMediaType(value: string | string[] | undefined): MediaType {
  return value === 'tv' ? 'tv' : 'movie'
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params
  const query = await searchParams
  const { language, locale } = await getServerMetadataContext()

  const segment = parseResourceSegment(id)
  const tmdbId = segment.id
  const type = resolveMediaType(query.type)

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return {
      title: 'Title not found',
      description: SITE_DESCRIPTION,
      robots: { index: false, follow: false },
    }
  }

  try {
    const [details, canonicalDetails] = await Promise.all([
      getTitleSeoData(tmdbId, type, language),
      getTitleSeoData(tmdbId, type, 'en'),
    ])

    const presentation = getTitlePresentation(details)
    const pageTitle = socialMetadataText(presentation.title)
    const description = socialMetadataText(buildTitleDescription(details))

    // Canonical URLs must be language-independent and match middleware.
    const canonicalPath = titlePath(tmdbId, canonicalDetails.title, type)
    const canonical = absoluteUrl(canonicalPath)

    const image = socialImage(
      `/api/og/title/${tmdbId}?type=${type}&language=${encodeURIComponent(language)}`,
      `${pageTitle} on Kino`
    )

    return {
      title: pageTitle,
      description,

      alternates: {
        canonical,
      },

      openGraph: {
        title: pageTitle,
        description,
        images: [image],
        locale,
        siteName: SITE_NAME,
        type: 'website',
        url: canonical,
      },

      twitter: {
        card: 'summary_large_image',
        title: pageTitle,
        description,
        images: [image],
      },

      robots: {
        index: true,
        follow: true,
      },
    }
  } catch {
    return {
      title: `Title ${tmdbId}`,
      description: SITE_DESCRIPTION,
      robots: {
        index: false,
        follow: false,
      },
    }
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams
  const { language } = await getServerMetadataContext()

  const segment = parseResourceSegment(id)
  const tmdbId = segment.id
  const type = resolveMediaType(query.type)

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return <TitlePage />
  }

  const details = await getTitleSeoData(tmdbId, type, language)

  const canonicalPath = titlePath(tmdbId, details.title, type)

  const jsonLd = buildTitleSchema({
    details,
    url: absoluteUrl(canonicalPath),
  })

  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: safeJsonLd,
        }}
        type="application/ld+json"
      />

      <TitlePage />
    </>
  )
}
