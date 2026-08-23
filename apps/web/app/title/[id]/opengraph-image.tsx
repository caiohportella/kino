import { ImageResponse } from 'next/og'
import { getRequestLanguage } from '@/lib/localization/server-localization'
import { FallbackOg, getOgImageOptions, OG_CONTENT_TYPE, OG_SIZE, TitleOg } from '@/lib/og/og'
import { KINO_OG_LOGO_URL } from '@/lib/og/og-assets'
import { safeImageData } from '@/lib/og/og-images'
import { parseResourceSegment } from '@/lib/routes'
import { getTitlePresentation } from '@/lib/seo/seo'
import { getTitleSeoDataBySegment } from '@/lib/tmdb/server-tmdb'

export const runtime = 'nodejs'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Kino title preview'

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const segment = parseResourceSegment(id)
  const tmdbId = segment.id
  const logo = await safeImageData(KINO_OG_LOGO_URL)

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return new ImageResponse(
      <FallbackOg label="Title preview" logo={logo} title="This title is unavailable." />,
      await getOgImageOptions()
    )
  }

  try {
    const details = await getTitleSeoDataBySegment(tmdbId, segment.slug, await getRequestLanguage())
    const presentation = getTitlePresentation(details)
    const [backdrop, poster] = await Promise.all([
      safeImageData(details.backdropImage),
      safeImageData(details.coverImage),
    ])

    return new ImageResponse(
      <TitleOg
        backdrop={backdrop}
        genres={details.genres.map((genre) => genre.name)}
        logo={logo}
        poster={poster}
        runtime={details.runtime}
        seasons={details.totalSeasons}
        status={details.status}
        synopsis={details.synopsis}
        title={presentation.title}
        type={details.type}
        year={presentation.year}
      />,
      await getOgImageOptions()
    )
  } catch {
    return new ImageResponse(
      <FallbackOg label="Title preview" logo={logo} title="This title is unavailable." />,
      await getOgImageOptions()
    )
  }
}
