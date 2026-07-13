import { ImageResponse } from 'next/og'
import { DiscoverOg, getOgImageOptions, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const runtime = 'edge'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Discover trending movies, series, and new releases on Kino'

export default async function OpenGraphImage() {
  return new ImageResponse(
    <DiscoverOg />,
    await getOgImageOptions()
  )
}
