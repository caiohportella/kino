import { ImageResponse } from 'next/og'
import { createElement } from 'react'
import { getOgImageOptions, SettingsOg } from '@/lib/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    createElement(SettingsOg, {
      avatar: null,
      data: {
        avatarUrl: null,
        bio: null,
        diaryEntries: 0,
        displayName: 'Kino member',
        episodesWatched: 0,
        movieRatings: 0,
        username: null,
      },
    }),
    await getOgImageOptions({ 'cache-control': 'public, max-age=86400' })
  )
}
