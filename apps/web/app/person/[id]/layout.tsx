import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { cache } from 'react'
import { isCanonicalResourceSegment, parseResourceSegment, personPath } from '@/lib/routes'
import { absoluteUrl, buildPersonSchema } from '@/lib/seo/seo'
import { getServerMetadataContext, pageMetadata } from '@/lib/seo/server-metadata'
import { getPersonSeoData } from '@/lib/tmdb/server-tmdb'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { language, locale, t } = await getServerMetadataContext()
  const personId = parseResourceSegment(id).id

  if (!Number.isFinite(personId) || personId <= 0) {
    return {
      ...pageMetadata({
        canonical: absoluteUrl(`/person/${personId || id}`),
        description: t('metadata.siteDescription'),
        index: false,
        locale,
        title: t('metadata.personNotFound'),
      }),
    }
  }

  try {
    const person = await getPersonSeoData(personId, language)
    const pageTitle = person.name
    const description = person.biography || t('metadata.personDescription', { name: person.name })
    const canonical = absoluteUrl(personPath(personId, person.name))

    return pageMetadata({
      canonical,
      description,
      index: true,
      locale,
      title: pageTitle,
      type: 'profile',
    })
  } catch {
    const fallbackTitle = t('metadata.personNotFound')
    return pageMetadata({
      canonical: absoluteUrl(`/person/${personId}`),
      description: t('metadata.siteDescription'),
      index: false,
      locale,
      title: fallbackTitle,
      type: 'profile',
    })
  }
}

const getPersonJsonLd = cache(async (personId: number) => {
  const person = await getPersonSeoData(personId)
  const image = person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : null
  return buildPersonSchema({
    person,
    image,
    url: absoluteUrl(personPath(personId, person.name)),
  })
})

export default async function PersonLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const personId = parseResourceSegment(id).id
  if (!Number.isFinite(personId) || personId <= 0) return children

  try {
    const person = await getPersonSeoData(personId)
    const canonicalPath = personPath(personId, person.name)
    if (!isCanonicalResourceSegment(id, personId, person.name)) permanentRedirect(canonicalPath)
    const jsonLd = await getPersonJsonLd(personId)
    const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: safeJsonLd }} type="application/ld+json" />
        {children}
      </>
    )
  } catch {
    return children
  }
}
