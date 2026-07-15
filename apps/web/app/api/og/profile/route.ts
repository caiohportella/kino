import { ImageResponse } from 'next/og'
import { createElement } from 'react'
import { getOgImageOptions, ProfileOg } from '@/lib/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    createElement(ProfileOg, {
      avatar: null,
      data: {
        avatarUrl: null,
        bannerUrl: null,
        bio: 'Movies, series, and a viewing history kept on Kino.',
        diaryEntries: 0,
        displayName: 'Kino member',
        moviesWatched: 0,
        seriesWatched: 0,
        username: null,
      },
    }),
    await getOgImageOptions({ 'cache-control': 'public, max-age=86400' })
  )
}
