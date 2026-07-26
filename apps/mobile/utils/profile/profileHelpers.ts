import type { UserProfile } from '~/types'

export function getProfileShareResource(profile: UserProfile | null, isOwnProfile: boolean) {
  return {
    canonicalUrl: `https://kino.app/${profile?.username || profile?.id || 'unknown'}`,
    shareText: `Check out ${isOwnProfile ? 'my' : profile?.display_name || 'this'} Kino profile:`,
    title: profile?.display_name || profile?.username || 'Kino profile',
  }
}
