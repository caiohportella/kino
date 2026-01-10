import { Modal, View, Text, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { getTMDbService } from '~/services/tmdb';
import type { TMDbTitle } from '~/types';

interface BannerSelectorModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectBanner: (url: string) => void;
}

export function BannerSelectorModal({ visible, onClose, onSelectBanner }: BannerSelectorModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TMDbTitle[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const tmdb = getTMDbService();
            const response = await tmdb.search(query);
            // Filter results that have a backdrop image
            setResults(response.results.filter(item => item.backdrop_path));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (item: TMDbTitle) => {
        const tmdb = getTMDbService();
        const url = tmdb.getBackdropUrl(item.backdrop_path, 'original');
        if (url) {
            onSelectBanner(url);
            onClose();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <BlurView intensity={20} className="flex-1 pt-12">
                <View className="flex-1 bg-primary rounded-t-3xl overflow-hidden border-t border-white/10">
                    {/* Header */}
                    <View className="px-4 py-4 border-b border-surface flex-row items-center justify-between bg-surface">
                        <Text className="text-lg font-bold text-text-primary">Select Banner</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#B0B0B0" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View className="p-4 flex-row gap-2">
                        <View className="flex-1 flex-row items-center bg-surface px-4 py-2 rounded-lg border border-white/5">
                            <Ionicons name="search" size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-2 text-text-primary font-medium"
                                placeholder="Search movies or series..."
                                placeholderTextColor="#9CA3AF"
                                value={query}
                                onChangeText={setQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                                autoFocus
                            />
                        </View>
                    </View>

                    {/* Results */}
                    {loading ? (
                        <ActivityIndicator size="large" color="#1DB954" className="mt-8" />
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={{ padding: 16, gap: 16 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="bg-surface rounded-xl overflow-hidden border border-white/5 active:opacity-80"
                                    onPress={() => handleSelect(item)}
                                >
                                    <View className="h-32 w-full bg-black/50">
                                        <Image
                                            source={{ uri: `https://image.tmdb.org/t/p/w780${item.backdrop_path}` }}
                                            className="w-full h-full"
                                            resizeMode="cover"
                                        />
                                    </View>
                                    <View className="p-3">
                                        <Text className="text-text-primary font-bold text-base" numberOfLines={1}>
                                            {item.title || item.name}
                                        </Text>
                                        <Text className="text-text-secondary text-xs">
                                            {(item.release_date || item.first_air_date || '').split('-')[0]}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View className="items-center mt-12">
                                    <Ionicons name="image-outline" size={48} color="#333" />
                                    <Text className="text-text-secondary mt-4">
                                        Search for a title to use its backdrop as your profile banner.
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </BlurView>
        </Modal>
    );
}
