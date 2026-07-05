// Profile header with banner, avatar, and user info
import { View, Text, TouchableOpacity, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { UserProfile } from '~/types'

interface ProfileHeaderProps {
  profile: UserProfile | null
  isOwnProfile: boolean
  isFollowing: boolean
  onSearchPress: () => void
  onSharePress: () => void
  onFollowToggle: () => void
  onEditBannerPress?: () => void
  onEditAvatarPress?: () => void
}

export function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  onSearchPress,
  onSharePress,
  onFollowToggle,
  onEditBannerPress,
  onEditAvatarPress,
}: ProfileHeaderProps) {
  const router = useRouter()

  return (
    <>
      {/* Banner */}
      <View className="h-48 w-full bg-surface relative">
        <TouchableOpacity
          activeOpacity={isOwnProfile && onEditBannerPress ? 0.8 : 1}
          onPress={isOwnProfile && onEditBannerPress ? onEditBannerPress : undefined}
          className="w-full h-full"
        >
          {profile?.banner_url ? (
            <Image
              source={{ uri: profile.banner_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-gray-900 items-center justify-center">
              <Ionicons name="image-outline" size={48} color="#333" />
            </View>
          )}

          {isOwnProfile && onEditBannerPress && (
            <View className="absolute bottom-2 right-4 bg-black/50 p-2 rounded-full">
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
        <View className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-primary to-transparent pointer-events-none" />

        {/* Search / Back Button - Top Left */}
        <View className="absolute top-12 left-4">
          {isOwnProfile ? (
            <TouchableOpacity onPress={onSearchPress} className="bg-black/30 p-2 rounded-full">
              <Ionicons name="search" size={24} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.back()} className="bg-black/30 p-2 rounded-full">
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Header Buttons - Top Right */}
        <View className="absolute top-12 right-4 flex-row">
          <TouchableOpacity onPress={onSharePress} className="bg-black/30 p-2 rounded-full mr-3">
            <Ionicons name="share-social-outline" size={24} color="#FFF" />
          </TouchableOpacity>

          {isOwnProfile && (
            <TouchableOpacity
              onPress={() => router.push('/profile/settings')}
              className="bg-black/30 p-2 rounded-full"
            >
              <Ionicons name="settings-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Profile Info */}
      <View className="px-4 -mt-16 mb-8 items-center">
        <TouchableOpacity
          activeOpacity={isOwnProfile && onEditAvatarPress ? 0.8 : 1}
          onPress={isOwnProfile && onEditAvatarPress ? onEditAvatarPress : undefined}
          className="relative mb-4"
        >
          <View className="rounded-full border-4 border-primary bg-surface overflow-hidden h-24 w-24 items-center justify-center">
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
            ) : (
              <Ionicons name="person" size={40} color="#666" />
            )}
          </View>
          {isOwnProfile && onEditAvatarPress && (
            <View className="absolute bottom-0 right-0 bg-accent p-1.5 rounded-full border-2 border-primary">
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        <View className="items-center">
          <View className="flex-row items-center justify-center">
            {/* Ghost element to balance the icon and keep text centered */}
            {!isOwnProfile && <View className="w-8 ml-2" />}

            <Text className="text-2xl font-bold text-text-primary text-center">
              {profile?.display_name || profile?.username || 'User'}
            </Text>

            {!isOwnProfile && (
              <TouchableOpacity
                onPress={onFollowToggle}
                className="w-8 ml-2 items-center justify-center"
              >
                <Ionicons
                  name={isFollowing ? 'checkmark-circle' : 'person-add'}
                  size={18}
                  color={isFollowing ? '#1DB954' : '#FFF'}
                />
              </TouchableOpacity>
            )}
          </View>

          {profile?.bio && (
            <Text className="text-text-secondary text-sm mt-1 text-center">{profile.bio}</Text>
          )}

          {profile?.username && (
            <Text className="text-text-secondary text-xs mt-1 text-center opacity-70">
              @{profile.username}
            </Text>
          )}
        </View>
      </View>
    </>
  )
}
