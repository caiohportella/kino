import { ImageResponse } from 'next/og'
import { DiaryOg, getOgImageOptions, OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og'

export const runtime = 'edge'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Kino cinema diary — remember every watch and rating'

export default async function OpenGraphImage() {
  return new ImageResponse(<DiaryOg />, await getOgImageOptions())
}
