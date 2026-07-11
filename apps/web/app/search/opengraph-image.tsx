import { ImageResponse } from 'next/og'
import { FeatureOg, getOgImageOptions, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const runtime = 'edge'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Search movies and TV series on Kino'

export default async function OpenGraphImage() {
  return new ImageResponse(
    <FeatureOg
      description="Search movies and series by title, genre, and rating without the noise."
      kind="search"
      label="Search"
      title="Every title, closer to hand."
    />,
    await getOgImageOptions()
  )
}
