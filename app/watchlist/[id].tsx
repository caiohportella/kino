import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { dbService } from '~/services/database';
import { getTMDbService } from '~/services/tmdb';
import { supabase } from '~/utils/supabase';
import type { Watchlist } from '~/types';
import { CreateWatchlistModal } from '~/components/CreateWatchlistModal';

type SortOption = 'release_date' | 'added_latest' | 'added_oldest';

export default function WatchlistDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    useEffect(() => {
        if (id) {
            loadWatchlistDetails();
        }
    }, [id]);

    const loadWatchlistDetails = async () => {
        try {
            const details = await dbService.getWatchlist(id as string);
            setWatchlist(details);

            const { data: listItems, error } = await supabase
                .from('watchlist_items')
                .select(`
                    *,
                    title:titles(*)
                `)
                .eq('watchlist_id', id);

            if (error) throw error;
            setItems(listItems || []);
        } catch (error) {
            console.error('Error loading watchlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const sortedItems = useMemo(() => {
        if (!items.length) return [];
        // Default sort: latest added first
        return [...items].sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    }, [items]);

    const handleDelete = () => {
        Alert.alert(
            'Delete Watchlist',
            'Are you sure you want to delete this watchlist? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await dbService.deleteWatchlist(id as string);
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete watchlist');
                        }
                    }
                }
            ]
        );
    };

    const handleRemoveItem = (item: any) => {
        Alert.alert(
            'Remove from Watchlist',
            `Are you sure you want to remove "${item.title.title}" from this watchlist?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        if (!watchlist) return;
                        try {
                            await dbService.removeFromWatchlist(watchlist.id, item.title.id);
                            // Optimistically update the list
                            setItems((prev) => prev.filter((i) => i.id !== item.id));
                        } catch (error) {
                            console.error('Error removing item:', error);
                            Alert.alert('Error', 'Failed to remove item');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-primary items-center justify-center">
                <ActivityIndicator size="large" color="#1DB954" />
            </View>
        );
    }

    if (!watchlist) {
        return (
            <View className="flex-1 bg-primary items-center justify-center">
                <Text className="text-text-secondary">Watchlist not found</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-accent">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-primary">
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerBackButtonDisplayMode: 'minimal',
                    headerTitle: watchlist.name,
                    headerTitleAlign: 'center',
                    headerStyle: { backgroundColor: '#121212' },
                    headerTintColor: '#fff',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <View className='flex-row gap-3 items-center justify-evenly'>
                            <TouchableOpacity
                                onPress={() => setShowEditModal(true)}
                                className="w-8 h-8 items-center justify-center rounded-full bg-white/10 mr-3"
                            >
                                <Ionicons name="pencil" size={16} color="#FFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleDelete}
                                className="w-8 h-8 items-center justify-center rounded-full bg-red-500/10"
                            >
                                <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />

            <FlatList
                data={sortedItems}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 20 }}
                columnWrapperStyle={{ gap: 8 }}
                renderItem={({ item }) => {
                    const tmdb = getTMDbService();
                    const imageUrl = tmdb.getImageUrl(item.title.cover_image, 'w300');

                    return (
                        <TouchableOpacity
                            className="flex-1 mb-2 aspect-[2/3] max-w-[33%] rounded-lg overflow-hidden bg-surface"
                            onPress={() => router.push(`/title/${item.title.tmdb_id}?type=${item.title.type}` as any)}
                            onLongPress={() => handleRemoveItem(item)}
                        >
                            {imageUrl ? (
                                <Image
                                    source={{ uri: imageUrl }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="w-full h-full items-center justify-center bg-[#333]">
                                    <Ionicons name="image-outline" size={24} color="#666" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View className="py-20 items-center">
                        <Text className="text-text-secondary text-center text-lg mb-2">Empty List</Text>
                        <Text className="text-text-secondary text-sm opacity-70">Add movies and shows to track what to watch next.</Text>
                    </View>
                }
            />

            <CreateWatchlistModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                initialValues={watchlist}
                onSuccess={(updatedList) => {
                    setWatchlist(updatedList);
                    setShowEditModal(false);
                }}
            />
        </View>
    );
}
