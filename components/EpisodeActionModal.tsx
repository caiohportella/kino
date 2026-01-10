import { Modal, View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { CreateWatchlistModal } from './CreateWatchlistModal';
import { BlurView } from 'expo-blur';
import { RatingStars } from './RatingStars';
import { dbService } from '~/services/database';
import { useEffect, useState } from 'react';
import type { Watchlist } from '~/types';

interface EpisodeActionModalProps {
    visible: boolean;
    onClose: () => void;
    episodeNumber: number;
    seasonNumber: number;
    titleId: string;
    initialRating?: number;
    initialWatchType?: 'first-time' | 'rewatch';
    onRate: (rating: number, watchType: 'first-time' | 'rewatch') => Promise<void>;
}

export function EpisodeActionModal({
    visible,
    onClose,
    episodeNumber,
    seasonNumber,
    titleId,
    initialRating = 0,
    initialWatchType = 'first-time',
    onRate,
}: EpisodeActionModalProps) {
    const [rating, setRating] = useState(initialRating);
    const [watchType, setWatchType] = useState<'first-time' | 'rewatch'>(initialWatchType);
    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [loadingLists, setLoadingLists] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (visible) {
            setRating(initialRating);
            setWatchType(initialWatchType);
            loadWatchlists();
        }
    }, [visible, initialRating, initialWatchType]);

    const loadWatchlists = async () => {
        setLoadingLists(true);
        try {
            const lists = await dbService.getUserWatchlists();
            setWatchlists(lists);
        } catch (error) {
            console.error('Failed to load watchlists', error);
        } finally {
            setLoadingLists(false);
        }
    };

    const handleAddToWatchlist = async (watchlistId: string) => {
        try {
            await dbService.addToWatchlist(watchlistId, titleId);
            Alert.alert('Success', 'Added to watchlist');
        } catch (error) {
            Alert.alert('Error', 'Failed to add to watchlist');
        }
    };

    const handleSaveRating = async () => {
        if (rating > 0) {
            await onRate(rating, watchType);
            onClose();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <BlurView intensity={20} className="flex-1 justify-center bg-black/50 px-6">
                <View className="rounded-2xl bg-surface p-6 shadow-xl border border-white/10">
                    <Text className="text-xl font-bold text-text-primary mb-2">
                        Episode {seasonNumber}x{episodeNumber}
                    </Text>
                    <Text className="text-text-secondary mb-6">Mark as watched & rate</Text>

                    {/* Rating Section */}
                    <View className="items-center mb-8">
                        <RatingStars
                            rating={rating}
                            onRatingChange={setRating}
                            size={40}
                            showValue
                        />
                    </View>

                    {/* Watch Type Selector */}
                    <View className="flex-row mb-6 bg-surface border border-white/10 rounded-lg p-1">
                        <TouchableOpacity
                            className={`flex-1 items-center py-2 rounded-md ${watchType === 'first-time' ? 'bg-accent' : ''}`}
                            onPress={() => setWatchType('first-time')}
                        >
                            <Text className={`font-medium ${watchType === 'first-time' ? 'text-primary' : 'text-text-secondary'}`}>First Time</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 items-center py-2 rounded-md ${watchType === 'rewatch' ? 'bg-accent' : ''}`}
                            onPress={() => setWatchType('rewatch')}
                        >
                            <Text className={`font-medium ${watchType === 'rewatch' ? 'text-primary' : 'text-text-secondary'}`}>Rewatch</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Actions */}
                    <TouchableOpacity
                        onPress={handleSaveRating}
                        className={`mb-4 rounded-full py-3 items-center ${rating > 0 ? 'bg-accent' : 'bg-surface border border-white/10'
                            }`}
                    >
                        <Text className={`font-semibold ${rating > 0 ? 'text-primary' : 'text-text-secondary'}`}>
                            {rating > 0 ? 'Save to Diary' : 'Select a Rating'}
                        </Text>
                    </TouchableOpacity>

                    {/* Watchlist Section */}
                    <View className="mt-4 border-t border-white/10 pt-4">
                        <Text className="text-text-secondary mb-3 text-sm">Add Show to Watchlist</Text>
                        <ScrollView className="max-h-32">
                            {watchlists.map(list => (
                                <TouchableOpacity
                                    key={list.id}
                                    className="py-2 border-b border-white/5 flex-row justify-between items-center"
                                    onPress={() => handleAddToWatchlist(list.id)}
                                >
                                    <Text className="text-text-primary">{list.name}</Text>
                                    <Text className="text-accent text-xs">Add</Text>
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                className="py-3 items-center border-t border-white/5 mt-2"
                                onPress={() => setShowCreateModal(true)}
                            >
                                <Text className="text-accent font-medium">Create New Watchlist</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>

                    <TouchableOpacity onPress={onClose} className="mt-6 items-center">
                        <Text className="text-text-secondary">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </BlurView>

            <CreateWatchlistModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={(newList) => {
                    setWatchlists([newList, ...watchlists]);
                    setShowCreateModal(false);
                    handleAddToWatchlist(newList.id);
                }}
            />
        </Modal>
    );
}
