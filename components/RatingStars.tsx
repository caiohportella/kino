// Reusable star rating component
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RatingStarsProps {
  rating: number; // 0-5
  maxRating?: number;
  size?: number;
  color?: string;
  onRatingChange?: (rating: number) => void;
  showValue?: boolean;
  readonly?: boolean;
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = 24,
  color = '#FFC107',
  onRatingChange,
  showValue = false,
  readonly = false,
}: RatingStarsProps) {
  const handlePress = (value: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value);
    }
  };

  return (
    <View className="flex-row items-center gap-1">
      {Array.from({ length: maxRating }, (_, i) => {
        const starValue = i + 1;

        let iconName: keyof typeof Ionicons.glyphMap = 'star-outline';
        if (rating >= starValue) {
          iconName = 'star';
        } else if (rating >= starValue - 0.5) {
          iconName = 'star-half';
        }

        const isFilled = rating >= starValue - 0.5;

        return (
          <View key={i} className="relative">
            <Ionicons
              name={iconName}
              size={size}
              color={isFilled ? color : '#333333'}
            />
            {!readonly && (
              <View className="absolute inset-0 flex-row">
                <TouchableOpacity
                  className="h-full w-1/2"
                  onPress={() => handlePress(starValue - 0.5)}
                  activeOpacity={1}
                  accessibilityLabel={`Rate ${starValue - 0.5} stars`}
                />
                <TouchableOpacity
                  className="h-full w-1/2"
                  onPress={() => handlePress(starValue)}
                  activeOpacity={1}
                  accessibilityLabel={`Rate ${starValue} stars`}
                />
              </View>
            )}
          </View>
        );
      })}
      {showValue && rating > 0 && (
        <Text className="ml-2 text-sm text-text-secondary">{rating.toFixed(1)}</Text>
      )}
    </View>
  );
}
