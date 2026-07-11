import type { Metadata } from 'next'
import { ProfileView } from '@/components/profile-view'
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, socialImage, trimText } from '@/lib/seo'
import { getPublicProfileOgData } from '@/lib/server-supabase'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params

  try {
    const profile = await getPublicProfileOgData(id)
    if (!profile) return unavailableProfileMetadata()

    const title = profile.displayName
    const username = profile.username ? `@${profile.username}` : 'Kino member'
    const description = profile.bio
      ? trimText(profile.bio, 160)
      : trimText(`${username}'s public movie and series profile on Kino.`, 160)
    const canonical = absoluteUrl(`/profile/${id}`)
    const image = socialImage(`/api/og/profile/${id}`, `${profile.displayName}'s public Kino profile`)

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        description,
        images: [image],
        siteName: SITE_NAME,
        title,
        type: 'profile',
        url: canonical,
      },
      robots: { index: true, follow: true },
      twitter: {
        card: 'summary_large_image',
        description,
        images: [image],
        title,
      },
    }
  } catch {
    return unavailableProfileMetadata()
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProfileView profileId={id} />
}

function unavailableProfileMetadata(): Metadata {
  const image = socialImage('/api/og/fallback', 'Kino — profile unavailable')
  return {
    title: 'Profile unavailable',
    description: SITE_DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: {
      description: SITE_DESCRIPTION,
      images: [image],
      siteName: SITE_NAME,
      title: 'Profile unavailable',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      description: SITE_DESCRIPTION,
      images: [image],
      title: 'Profile unavailable',
    },
  }
}
