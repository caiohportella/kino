import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StarBreakdown as StarBreakdownType } from '~/types';

interface StarBreakdownProps {
    stats: StarBreakdownType;
    totalRatings: number;
}

export function StarBreakdown({ stats, totalRatings }: StarBreakdownProps) {
    if (totalRatings === 0) return null;

    return (
        <View className="mt-4">
            {[5, 4, 3, 2, 1].map((star) => {
                const count = stats[star] || 0;
                const percentage = (count / totalRatings) * 100;

                return (
                    <View key={star} className="mb-2 flex-row items-center">
                        <View className="w-8 flex-row items-center justify-end mr-2 gap-1">
                            <Text className="text-xs font-medium text-text-secondary">{star}</Text>
                            <Ionicons name="star" size={10} color="#666" />
                        </View>
                        <View className="mx-2 h-2 flex-1 overflow-hidden rounded-full bg-[#333333]">
                            <View
                                className="h-full rounded-full bg-[#FFC107]"
                                style={{ width: `${percentage}%` }}
                            />
                        </View>
                        <Text className="w-8 text-right text-xs text-text-secondary">{count}</Text>
                    </View>
                );
            })}
        </View>
    );
}
