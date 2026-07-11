import type { Metadata } from 'next'
import { OgIdentitySync } from '@/components/og-identity-sync'
import { SITE_NAME, absoluteUrl, socialImage } from '@/lib/seo'
import { getPublicProfileOgData } from '@/lib/server-supabase'
import SettingsPageClient from './settings-page-client'

type Props = {
  searchParams: Promise<{ profile?: string | string[] }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = await searchParams
  const profileId = Array.isArray(query.profile) ? query.profile[0] : query.profile
  const profile = profileId ? await getPublicProfileOgData(profileId).catch(() => null) : null
  const image = profile
    ? socialImage(`/api/og/settings/${profileId}`, `${profile.displayName}'s Kino settings preview`)
    : socialImage('/api/og/settings', 'Kino settings preview')
  const title = 'Settings'
  const description = profile
    ? `Kino settings for ${profile.displayName}. No private preferences are included.`
    : 'Manage your Kino profile and app preferences.'

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/settings') },
    robots: { index: false, follow: false },
    openGraph: {
      description,
      images: [image],
      siteName: SITE_NAME,
      title: 'Settings | Kino',
      type: 'website',
      url: absoluteUrl(profileId ? `/settings?profile=${profileId}` : '/settings'),
    },
    twitter: {
      card: 'summary_large_image',
      description,
      images: [image],
      title: 'Settings | Kino',
    },
  }
}

export default function SettingsPage() {
  return (
    <>
      <OgIdentitySync />
      <SettingsPageClient />
    </>
  )
}
