import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { ProfileMoviesPage } from '@/components/profile/collections/profile-movies-page'
import { isReservedProfileRoute, normalizeProfileUsername } from '@/lib/profile/profile-routes'
import { profileMoviesPath } from '@/lib/routes'
import { absoluteUrl } from '@/lib/seo/seo'
import { getServerMetadataContext, pageMetadata } from '@/lib/seo/server-metadata'

async function getProfile(username: string) {
  if (isReservedProfileRoute(username)) return null

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      'https://example.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      'missing-anon-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .ilike('username', username)
    .maybeSingle()

  if (error) throw error

  return data
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const routeParams = await params
  const { locale, t } = await getServerMetadataContext()
  const username = normalizeProfileUsername(routeParams.username)

  if (!username || isReservedProfileRoute(username)) {
    return {}
  }

  let profile
  let lookupFailed = false

  try {
    profile = await getProfile(username)
  } catch (error) {
    lookupFailed = true

    console.error('[profile-movies-metadata] profile lookup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stage: 'profile-lookup',
      username,
    })
  }

  const canonicalUsername = profile?.username || username

  const displayName =
    profile?.display_name ||
    (profile
      ? canonicalUsername
      : lookupFailed
        ? t('metadata.profileUnavailable')
        : t('metadata.profileNotFound'))

  return pageMetadata({
    canonical: absoluteUrl(profileMoviesPath(canonicalUsername)),
    description:
      profile || !lookupFailed
        ? t('metadata.profileMoviesDescription', {
            defaultValue: 'Browse movies watched by @{{username}} on Kino.',
            username: canonicalUsername,
          })
        : t('metadata.profileUnavailable'),
    index: Boolean(profile),
    locale,
    title: t('metadata.profileMoviesTitle', {
      defaultValue: "{{name}}'s movies",
      name: displayName,
    }),
    type: 'profile',
  })
}

export default async function UsernameMoviesPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const normalizedUsername = normalizeProfileUsername(username)

  if (!normalizedUsername || isReservedProfileRoute(normalizedUsername)) {
    notFound()
  }

  const profile = await getProfile(normalizedUsername)

  if (!profile) {
    notFound()
  }

  if (profile.username !== normalizedUsername) {
    permanentRedirect(profileMoviesPath(profile.username))
  }

  return (
    <ProfileMoviesPage
      displayName={profile.display_name || profile.username || normalizedUsername}
      profileId={profile.id}
      username={profile.username || normalizedUsername}
    />
  )
}
