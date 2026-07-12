import { ImageResponse } from 'next/og'
import { FeatureOg, getOgImageOptions, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const runtime = 'edge'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Discover trending movies, series, and new releases on Kino'

export default async function OpenGraphImage() {
  return new ImageResponse(
    <FeatureOg
      description="Trending stories, new releases, and acclaimed picks in one focused feed."
      kind="discover"
      label="Discover"
      title="Find the next story worth keeping."
    />,
    await getOgImageOptions()
  )
}