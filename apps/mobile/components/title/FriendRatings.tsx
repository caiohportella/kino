import { View, Text, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { RatingStars } from '~/components/common/RatingStars'
import type { FriendRating } from '~/hooks/data/useFriendRatings'

interface FriendRatingsProps {
  ratings: FriendRating[]
}

function FriendAvatar({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        className="h-7 w-7 rounded-full"
        resizeMode="cover"
      />
    )
  }

  return (
    <View className="h-7 w-7 items-center justify-center rounded-full bg-surface">
      <Ionicons name="person" size={14} color="#B0B0B0" />
    </View>
  )
}

/**
 * Displays friend ratings for a movie title (above Community Ratings)
 */
export function FriendRatings({ ratings }: FriendRatingsProps) {
  const { t } = useTranslation()

  if (!ratings || ratings.length === 0) return null

  return (
    <View className="mb-6">
      <Text className="mb-3 text-lg font-bold text-text-primary">
        {t('title.friendRatings')}
      </Text>
      <View className="rounded-xl border border-black/50 bg-surface p-3">
        {ratings.map((friend) => (
          <View key={friend.userId} className="mb-2 last:mb-0 flex-row items-center gap-3">
            <FriendAvatar
              avatarUrl={friend.avatarUrl}
              name={friend.displayName || friend.username || ''}
            />
            <Text className="flex-1 text-sm font-medium text-text-primary" numberOfLines={1}>
              {friend.displayName || friend.username || 'User'}
            </Text>
            <RatingStars rating={friend.rating} readonly size={14} />
          </View>
        ))}
      </View>
    </View>
  )
}

interface FriendEpisodeRatingsProps {
  ratings: FriendRating[]
}

/**
 * Compact inline display of friend ratings for a specific episode
 * Renders above the episode title in SeasonSection
 */
export function FriendEpisodeRatings({ ratings }: FriendEpisodeRatingsProps) {
  if (!ratings || ratings.length === 0) return null

  return (
    <View className="mb-1 flex-row flex-wrap items-center gap-2">
      {ratings.map((friend) => (
        <View key={friend.userId} className="flex-row items-center gap-1">
          <FriendAvatar
            avatarUrl={friend.avatarUrl}
            name={friend.displayName || friend.username || ''}
          />
          <RatingStars rating={friend.rating} readonly size={10} />
        </View>
      ))}
    </View>
  )
}
