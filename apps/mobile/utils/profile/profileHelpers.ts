// Helper utilities for profile screen
import { Share, Alert } from 'react-native'
import type { UserProfile } from '~/types'

/**
 * Share a user's profile
 */
export async function shareProfile(
  profile: UserProfile | null,
  isOwnProfile: boolean
): Promise<void> {
  const shareUrl = `https://kino.app/${profile?.username || profile?.id || 'unknown'}`

  try {
    await Share.share({
      message: `Check out ${isOwnProfile ? 'my' : profile?.display_name || 'this'} Kino profile: ${shareUrl}`,
      url: shareUrl,
    })
  } catch (error) {
    console.error('Failed to share profile:', error)
    Alert.alert('Error', 'Failed to share profile')
  }
}
