import type { MediaType } from '@kino/core'
import type { Metadata } from 'next'
import { getTitleSeoData } from '@/lib/server-tmdb'
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  buildTitleDescription,
  buildTitleSchema,
  socialImage,
} from '@/lib/seo'
import TitlePageClient from './title-page-client'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string | string[] }>
}

function getMediaType(value: string | string[] | undefined): MediaType {
  return (Array.isArray(value) ? value[0] : value) === 'tv' ? 'tv' : 'movie'
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const tmdbId = Number(id)
  const type = getMediaType(query.type)

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return unavailableMetadata()
  }

  try {
    const details = await getTitleSeoData(tmdbId, type)
    const pageTitle = `${details.title}${details.year ? ` (${details.year})` : ''}`
    const description = buildTitleDescription(details)
    const canonical = absoluteUrl(`/title/${tmdbId}?type=${type}`)
    const image = socialImage(
      `/api/og/title/${tmdbId}?type=${type}`,
      `${details.title} — ${type === 'tv' ? 'series' : 'movie'} preview on Kino`
    )

    return {
      title: pageTitle,
      description,
      alternates: { canonical },
      openGraph: {
        description,
        images: [image],
        siteName: SITE_NAME,
        title: pageTitle,
        type: 'website',
        url: canonical,
      },
      robots: { index: true, follow: true },
      twitter: {
        card: 'summary_large_image',
        description,
        images: [image],
        title: pageTitle,
      },
    }
  } catch {
    return unavailableMetadata()
  }
}

export default async function TitlePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const tmdbId = Number(id)
  const type = getMediaType(query.type)
  let jsonLd: ReturnType<typeof buildTitleSchema> | null = null

  if (Number.isFinite(tmdbId) && tmdbId > 0) {
    try {
      const details = await getTitleSeoData(tmdbId, type)
      jsonLd = buildTitleSchema({
        details,
        url: absoluteUrl(`/title/${tmdbId}?type=${type}`),
      })
    } catch {
      jsonLd = null
    }
  }

  const safeJsonLd = jsonLd ? JSON.stringify(jsonLd).replace(/</g, '\\u003c') : null
  return (
    <>
      {safeJsonLd ? <script dangerouslySetInnerHTML={{ __html: safeJsonLd }} type="application/ld+json" /> : null}
      <TitlePageClient />
    </>
  )
}

function unavailableMetadata(): Metadata {
  const image = socialImage('/api/og/fallback', 'Kino — page unavailable')
  return {
    title: 'Title unavailable',
    description: SITE_DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: {
      description: SITE_DESCRIPTION,
      images: [image],
      siteName: SITE_NAME,
      title: 'Title unavailable',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      description: SITE_DESCRIPTION,
      images: [image],
      title: 'Title unavailable',
    },
  }
}
