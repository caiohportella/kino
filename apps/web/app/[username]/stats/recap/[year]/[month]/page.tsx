import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { ProfileMonthlyRecapPage } from '@/components/profile/profile-monthly-recap-page'
import { isReservedProfileRoute, normalizeProfileUsername } from '@/lib/profile/profile-routes'
import { profileStatsRecapPath } from '@/lib/routes'
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
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .ilike('username', username)
    .maybeSingle()
  if (error) throw error
  return data
}

function normalizeMonth(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null
}

function normalizeYear(value: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1970 && parsed <= 2100 ? parsed : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; year: string; month: string }>
}): Promise<Metadata> {
  const routeParams = await params
  const { locale, t } = await getServerMetadataContext()
  const username = normalizeProfileUsername(routeParams.username)
  const year = normalizeYear(routeParams.year)
  const month = normalizeMonth(routeParams.month)
  if (!username || !year || !month || isReservedProfileRoute(username)) return {}

  const profile = await getProfile(username).catch(() => null)
  const canonicalUsername = profile?.username || username
  const canonical = absoluteUrl(profileStatsRecapPath(canonicalUsername, year, month))

  return pageMetadata({
    canonical,
    description: t('metadata.profileStatsDescription', { username: canonicalUsername }),
    index: Boolean(profile),
    locale,
    title: t('stats.monthlyRecap'),
    type: 'profile',
  })
}

export default async function UsernameStatsRecapPage({
  params,
}: {
  params: Promise<{ username: string; year: string; month: string }>
}) {
  const routeParams = await params
  const normalizedUsername = normalizeProfileUsername(routeParams.username)
  const year = normalizeYear(routeParams.year)
  const month = normalizeMonth(routeParams.month)
  if (!normalizedUsername || !year || !month || isReservedProfileRoute(normalizedUsername)) {
    notFound()
  }

  const profile = await getProfile(normalizedUsername)
  if (!profile) notFound()
  if (profile.username !== normalizedUsername) {
    permanentRedirect(profileStatsRecapPath(profile.username, year, month))
  }

  return (
    <ProfileMonthlyRecapPage
      displayName={profile.display_name || profile.username || normalizedUsername}
      month={month}
      profileId={profile.id}
      username={profile.username || normalizedUsername}
      year={year}
    />
  )
}
