import { ImageResponse } from 'next/og'
import { createElement, type ReactElement } from 'react'
import { FallbackOg, getOgImageOptions, SettingsOg } from '@/lib/og'
import { safeImageData } from '@/lib/og-images'
import { getPublicProfileOgData } from '@/lib/server-supabase'

export const runtime = 'edge'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const data = await getPublicProfileOgData(id)
    if (!data) {
      return image(createElement(FallbackOg, { title: 'Settings preview unavailable.', label: 'Settings' }))
    }
    const avatar = await safeImageData(data.avatarUrl)
    return image(createElement(SettingsOg, { avatar, data }))
  } catch {
    return image(createElement(FallbackOg, { title: 'Settings preview unavailable.', label: 'Settings' }))
  }
}

async function image(element: ReactElement) {
  return new ImageResponse(
    element,
    await getOgImageOptions({ 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' })
  )
}
