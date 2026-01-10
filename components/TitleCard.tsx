// Reusable title card component for displaying movies/TV shows
import React from 'react';
import { View, Text, TouchableWithoutFeedback, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { getTMDbService } from '~/services/tmdb';
import type { TMDbTitle } from '~/types';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface TitleCardProps {
  title: TMDbTitle;
  onPress?: () => void;
  showYear?: boolean;
}

export function TitleCard({ title, onPress, showYear = true }: TitleCardProps) {
  const router = useRouter();
  const tmdb = getTMDbService();
  const imageUrl = tmdb.getImageUrl(title.poster_path, 'w300');
  const displayTitle = title.title || title.name || 'Unknown';
  const year = title.release_date
    ? new Date(title.release_date).getFullYear()
    : title.first_air_date
      ? new Date(title.first_air_date).getFullYear()
      : null;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 10, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const handlePress =
    onPress ||
    (() => {
      const mediaType = title.media_type || (title.title ? 'movie' : 'tv');
      router.push(`/title/${title.id}?type=${mediaType}` as any);
    });

  const content = (
    <TouchableWithoutFeedback
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={animatedStyle} className="w-full overflow-hidden rounded-lg bg-surface shadow-sm max-w-full">
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="aspect-[2/3] w-full" resizeMode="cover" />
        ) : (
          <View className="aspect-[2/3] w-full items-center justify-center bg-[#333]">
            <Text className="text-xs text-text-secondary">No Image</Text>
          </View>
        )}
        <View className="h-[100px] p-2 justify-between w-full">
          <View>
            <Text className="text-sm font-semibold text-text-primary leading-tight" numberOfLines={3}>
              {displayTitle}
            </Text>
          </View>
          <View>
            {showYear && year && <Text className="mt-1 text-xs text-text-secondary">{year}</Text>}
            {title.vote_average > 0 && (
              <View className="mt-2.5 flex-row items-center gap-1">
                <Ionicons name="star" size={12} color="#FCC419" />
                <Text className="text-xs text-text-secondary">{title.vote_average.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );

  return content;
}
