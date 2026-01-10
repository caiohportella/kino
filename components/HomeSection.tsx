import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { TitleCard } from '~/components/TitleCard';
import { useRouter } from 'expo-router';
import type { TMDbTitle } from '~/types';

interface HomeSectionProps {
    title: string;
    data: TMDbTitle[];
    onViewAll?: () => void;
    loading?: boolean;
}

export function HomeSection({ title, data, onViewAll, loading = false }: HomeSectionProps) {
    const router = useRouter();

    if (loading || data.length === 0) {
        // Basic skeleton or empty state could be here, or just return null
        return null;
    }

    return (
        <View className="mb-8">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 mb-4">
                <Text className="text-xl font-bold text-text-primary">{title}</Text>
                {onViewAll && (
                    <TouchableOpacity onPress={onViewAll}>
                        <Text className="text-sm font-semibold text-accent">View All</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Horizontal List */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
                {data.map((item) => (
                    <View key={`${item.id}-${item.media_type}`} className="w-[120px]">
                        <TitleCard
                            title={item}
                            onPress={() => router.push(`/title/${item.id}?type=${item.media_type || (item.title ? 'movie' : 'tv')}` as any)}
                        />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
