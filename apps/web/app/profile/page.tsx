import type { Metadata } from 'next'
import { OgIdentitySync } from '@/components/og-identity-sync'
import { ProfileView } from '@/components/profile-view'
import { SITE_NAME, absoluteUrl, socialImage, trimText } from '@/lib/seo'
import { getPublicProfileOgData } from '@/lib/server-supabase'

type Props = {
  searchParams: Promise<{ profile?: string | string[] }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = await searchParams
  const profileId = Array.isArray(query.profile) ? query.profile[0] : query.profile
  const profile = profileId ? await getPublicProfileOgData(profileId).catch(() => null) : null
  const image = profile
    ? socialImage(`/api/og/profile/${profileId}`, `${profile.displayName}'s public Kino profile`)
    : socialImage('/api/og/profile', 'Kino public profile preview')
  const title = profile ? profile.displayName : 'Profile'
  const description = profile?.bio
    ? trimText(profile.bio, 160)
    : 'A public movie and series profile on Kino.'

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/profile') },
    robots: { index: false, follow: false },
    openGraph: {
      description,
      images: [image],
      siteName: SITE_NAME,
      title,
      type: 'profile',
      url: absoluteUrl(profileId ? `/profile?profile=${profileId}` : '/profile'),
    },
    twitter: {
      card: 'summary_large_image',
      description,
      images: [image],
      title,
    },
  }
}

export default function ProfilePage() {
  return (
    <>
      <OgIdentitySync />
      <ProfileView />
    </>
  )
}
