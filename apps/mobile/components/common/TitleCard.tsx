// Reusable title card component for displaying movies/TV shows
import React from 'react'
import { View, Text, TouchableWithoutFeedback, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { getTMDbService } from '~/services/tmdb'
import type { TMDbTitle } from '~/types'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { isOscarNominee } from '~/services/awards'
import { useTranslation } from 'react-i18next'
import { OscarBadge } from './OscarBadge'
import { useLocalizedTitle } from '~/hooks/data/useLocalizedMediaData'

interface TitleCardProps {
  title: TMDbTitle
  onPress?: () => void
  showYear?: boolean
}

export function TitleCard({ title, onPress, showYear = true }: TitleCardProps) {
  const router = useRouter()
  const tmdb = getTMDbService()
  const mediaType = title.media_type || (title.title ? 'movie' : 'tv')
  const localizedData = useLocalizedTitle(title.id, mediaType)

  const imageUrl = localizedData?.poster_path
    ? tmdb.getImageUrl(localizedData.poster_path, 'w300')
    : tmdb.getImageUrl(title.poster_path, 'w300')

  const displayTitle = localizedData?.title || title.title || title.name || 'Unknown'
  const year = title.release_date
    ? new Date(title.release_date).getFullYear()
    : title.first_air_date
      ? new Date(title.first_air_date).getFullYear()
      : null

  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const { t } = useTranslation()

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 10, stiffness: 300 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 })
  }

  const handlePress =
    onPress ||
    (() => {
      const mediaType = title.media_type || (title.title ? 'movie' : 'tv')
      router.push(`/title/${title.id}?type=${mediaType}`)
    })

  const content = (
    <TouchableWithoutFeedback
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={animatedStyle}
        className="w-full bg-surface shadow-sm max-w-full rounded-t-xl rounded-b-xl overflow-hidden"
      >
        {/* Top Poster Section */}
        <View className="relative w-full aspect-[2/3] bg-surface-variant overflow-hidden">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full items-center justify-center bg-[#333]">
              <Ionicons name="film-outline" size={32} color="#666" />
            </View>
          )}

          {/* Oscar badge overlay */}
          <OscarBadge tmdbId={title.id} />

          {/* Rating overlay badge at top right */}
          {title.vote_average > 0 && (
            <View className="absolute top-2 right-2 bg-black/60 rounded-md px-1.5 py-0.5 flex-row items-center gap-1 backdrop-blur-md">
              <Ionicons name="star" size={10} color="#FCC419" />
              <Text className="text-[10px] text-white font-bold tracking-tight">
                {title.vote_average.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Ticket Tear Line Area */}
        <View className="relative h-6 bg-surface-variant z-10 justify-center">
          {/* Dashed line */}
          <View className="absolute left-3 right-3 h-[1px] border-t border-dashed border-white/20" />

          {/* Left cutout (matches parent background, usually primary color but we'll use #121212 assuming dark theme) */}
          <View className="absolute -left-3 top-0 bottom-0 w-6 rounded-r-full bg-primary" />

          {/* Right cutout */}
          <View className="absolute -right-3 top-0 bottom-0 w-6 rounded-l-full bg-primary" />
        </View>

        {/* Bottom Metadata Section */}
        <View className="h-[76px] p-3 pt-1 justify-between w-full bg-surface-variant rounded-b-xl">
          <View>
            <Text
              className="text-sm font-black text-text-primary leading-tight tracking-tight"
              numberOfLines={2}
            >
              {displayTitle.toUpperCase()}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mt-auto">
            {showYear && year ? (
              <Text className="text-[11px] font-bold text-accent">{year}</Text>
            ) : <View />}

            <View className="bg-white/10 rounded px-1.5 py-0.5">
              <Text className="text-[9px] font-bold text-text-secondary uppercase">
                {title.media_type === 'movie' || (!title.media_type && title.title)
                  ? t('common.movie')
                  : t('common.tv')}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  )

  return content
}
