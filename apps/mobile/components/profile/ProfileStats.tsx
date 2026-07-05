// Profile stats component for followers/following counts
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

interface ProfileStatsProps {
  followersCount: number
  followingCount: number
  onFollowersPress: () => void
  onFollowingPress: () => void
}

export function ProfileStats({
  followersCount,
  followingCount,
  onFollowersPress,
  onFollowingPress,
}: ProfileStatsProps) {
  const { t } = useTranslation()

  return (
    <View className="flex-row items-center w-full justify-evenly mb-12 mt-4 px-4">
      <TouchableOpacity onPress={onFollowersPress} className="items-center">
        <Text className="text-xl font-bold text-text-primary">{followersCount}</Text>
        <Text className="text-xs text-text-secondary uppercase tracking-wider">
          {t('profile.followers')}
        </Text>
      </TouchableOpacity>

      <View className="h-8 w-[1px] bg-white/10" />

      <TouchableOpacity onPress={onFollowingPress} className="items-center">
        <Text className="text-xl font-bold text-text-primary">{followingCount}</Text>
        <Text className="text-xs text-text-secondary uppercase tracking-wider">
          {t('profile.following')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
