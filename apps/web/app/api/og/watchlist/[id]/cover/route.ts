import { ImageResponse } from 'next/og'
import { createElement } from 'react'
import { WatchlistProfileCover } from '@/components/watchlist/watchlist-cover'
import { safeImageData } from '@/lib/og/og-images'
import { getPublicWatchlistOgData } from '@/lib/server-supabase'

export const runtime = 'edge'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getPublicWatchlistOgData(id)
  const images = await Promise.all(
    (data?.titles || []).slice(0, 6).map((title) => safeImageData(title.cover_image))
  )
  const versioned = new URL(request.url).searchParams.has('v')

  return new ImageResponse(createElement(WatchlistProfileCover, { images }), {
    height: 900,
    width: 600,
    headers: {
      'cache-control': versioned
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60, must-revalidate',
    },
  })
}
