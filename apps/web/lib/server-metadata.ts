import type { Metadata } from 'next'
import { absoluteUrl, SITE_NAME, socialImage } from './seo'
import { getRequestLanguage, getTranslations } from './server-localization'

const OPEN_GRAPH_LOCALES = {
  en: 'en_US',
  fr: 'fr_FR',
  it: 'it_IT',
  no: 'nb_NO',
  pt: 'pt_BR',
} as const

export async function getServerMetadataContext() {
  const language = await getRequestLanguage()
  const t = await getTranslations(language)
  return { language, locale: OPEN_GRAPH_LOCALES[language], t }
}

export async function localizedRouteMetadata({
  canonicalPath,
  descriptionKey,
  imagePath,
  index = false,
  titleKey,
}: {
  canonicalPath: string
  descriptionKey: string
  imagePath?: { path: string; alt: string }
  index?: boolean
  titleKey: string
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
    robots: { index, follow: index },
    twitter: {
      card: 'summary_large_image',
      description,
      ...(image ? { images: [image] } : {}),
      title: socialTitle,
    },
  }
}
