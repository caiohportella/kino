import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { BlurView } from 'expo-blur';
import { useState, useEffect } from 'react';
import { dbService } from '~/services/database';
import type { Watchlist } from '~/types';

interface CreateWatchlistModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (watchlist: Watchlist) => void;
    initialValues?: Watchlist;
}

export function CreateWatchlistModal({ visible, onClose, onSuccess, initialValues }: CreateWatchlistModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isShared, setIsShared] = useState(false);
    const [loading, setLoading] = useState(false);

    // Initialize/Reset form when opening
    useEffect(() => {
        if (visible) {
            if (initialValues) {
                setName(initialValues.name);
                setDescription(initialValues.description || '');
                setIsShared(initialValues.isShared);
            } else {
                setName('');
                setDescription('');
                setIsShared(false);
            }
        }
    }, [visible, initialValues]);

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a name');
            return;
        }

        setLoading(true);
        try {
            let result: Watchlist;
            if (initialValues) {
                // Edit mode
                result = await dbService.updateWatchlist(initialValues.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    isShared
                });
            } else {
                // Create mode
                result = await dbService.createWatchlist(
                    name.trim(),
                    description.trim() || undefined,
                    undefined, // thumbnail
                    isShared
                );
            }
            onSuccess(result);
        } catch (error: any) {
            console.error('Watchlist Error:', error);
            Alert.alert('Error', error.message || 'Failed to save watchlist');
        } finally {
            setLoading(false);
        }
    };

    const isEditMode = !!initialValues;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <BlurView intensity={20} className="flex-1 justify-center bg-black/50 px-6">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="rounded-2xl bg-surface p-6 shadow-xl border border-white/10">
                        <Text className="text-xl font-bold text-text-primary mb-6">
                            {isEditMode ? 'Edit Watchlist' : 'New Watchlist'}
                        </Text>

                        <View className="mb-4">
                            <Text className="text-text-secondary mb-2 text-sm">Name</Text>
                            <TextInput
                                className="bg-black/30 text-text-primary p-3 rounded-lg border border-white/10"
                                placeholder="e.g. Weekend Binges"
                                placeholderTextColor="#666"
                                value={name}
                                onChangeText={setName}
                                autoFocus={!isEditMode}
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-text-secondary mb-2 text-sm">Description (Optional)</Text>
                            <TextInput
                                className="bg-black/30 text-text-primary p-3 rounded-lg border border-white/10"
                                placeholder="What's this list about?"
                                placeholderTextColor="#666"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={3}
                                style={{ textAlignVertical: 'top' }}
                            />
                        </View>

                        <View className="mb-6 flex-row items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                            <View className="flex-1 mr-4">
                                <Text className="text-text-primary font-medium mb-1">Make Shared?</Text>
                                <Text className="text-text-secondary text-xs">
                                    Create a code to invite friends to view or edit.
                                </Text>
                            </View>
                            <Switch
                                value={isShared}
                                onValueChange={setIsShared}
                                trackColor={{ false: '#333', true: '#1DB954' }}
                                thumbColor={isShared ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 py-3 rounded-lg bg-surface border border-white/10 items-center"
                                onPress={onClose}
                                disabled={loading}
                            >
                                <Text className="text-text-secondary font-semibold">Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="flex-1 py-3 rounded-lg bg-accent items-center"
                                onPress={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text className="text-primary font-bold">
                                        {isEditMode ? 'Save' : 'Create'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </BlurView>
        </Modal>
    );
}
