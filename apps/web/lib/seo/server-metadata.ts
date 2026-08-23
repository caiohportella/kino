import { KinoLanguage } from '@kino/core/locale-config'
import type { Metadata } from 'next'
import { getRequestLanguage, getTranslations } from '../localization/server-localization'
import { absoluteUrl, SITE_NAME, socialImage } from './seo'

const OPEN_GRAPH_LOCALES = {
  en: 'en_US',
  pt: 'pt_BR',
  fr: 'fr_FR',
  it: 'it_IT',
  no: 'nb_NO',
  es: 'es_ES',
  de: 'de_DE',
} as const satisfies Record<KinoLanguage, string>

export async function getServerMetadataContext() {
  const language = await getRequestLanguage()
  const t = await getTranslations(language)

  return {
    language,
    locale: OPEN_GRAPH_LOCALES[language],
    t,
  }
}

type LocalizedRouteMetadataOptions = {
  canonicalPath: string
  descriptionKey: string
  imagePath?: {
    path: string
    alt: string
  }
  titleKey: string
}

async function localizedRouteMetadata({
  canonicalPath,
  descriptionKey,
  imagePath,
  index,
  titleKey,
}: LocalizedRouteMetadataOptions & {
  index: boolean
}) {
  const { locale, t } = await getServerMetadataContext()
  const title = t(titleKey)
  const description = t(descriptionKey)
  const image = imagePath ? socialImage(imagePath.path, t(imagePath.alt)) : undefined

  return pageMetadata({
    canonical: absoluteUrl(canonicalPath),
    description,
    image,
    index,
    locale,
    title,
  })
}

export function localizedPublicRouteMetadata(options: LocalizedRouteMetadataOptions) {
  return localizedRouteMetadata({
    ...options,
    index: true,
  })
}

export function localizedPrivateRouteMetadata(options: LocalizedRouteMetadataOptions) {
  return localizedRouteMetadata({
    ...options,
    index: false,
  })
}

export function pageMetadata({
  canonical,
  description,
  image,
  index = false,
  locale,
  title,
  type = 'website',
}: {
  canonical: string
  description: string
  image?: ReturnType<typeof socialImage>
  index?: boolean
  locale?: string
  title: string
  type?: 'profile' | 'website'
}): Metadata {
  const socialTitle = `${title} | ${SITE_NAME}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      description,
      ...(image ? { images: [image] } : {}),
      ...(locale ? { locale } : {}),
      siteName: SITE_NAME,
      title: socialTitle,
      type,
      url: canonical,
    },
    robots: {
      index,
      follow: index,
    },
    twitter: {
      card: 'summary_large_image',
      description,
      ...(image ? { images: [image] } : {}),
      title: socialTitle,
    },
  }
}
