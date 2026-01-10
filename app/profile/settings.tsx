import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '~/hooks/useAuth';
import { dbService } from '~/services/database';
import * as ImagePicker from 'expo-image-picker';
import { BannerSelectorModal } from '~/components/BannerSelectorModal';
import type { UserProfile } from '~/types';

export default function SettingsScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [username, setUsername] = useState('');

    const [showBannerModal, setShowBannerModal] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [user?.id]);

    const loadProfile = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const profile = await dbService.getUserProfile(user.id);
            if (profile) {
                setDisplayName(profile.display_name || '');
                setBio(profile.bio || '');
                setAvatarUrl(profile.avatar_url);
                setBannerUrl(profile.banner_url || null);
                setUsername(profile.username || '');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setAvatarUrl(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            let finalAvatarUrl = avatarUrl;

            // Upload image if it's a local URI (not http)
            if (avatarUrl && !avatarUrl.startsWith('http')) {
                const uploadedUrl = await dbService.uploadAvatar(avatarUrl);
                if (uploadedUrl) {
                    finalAvatarUrl = uploadedUrl;
                }
            }

            await dbService.updateUserProfile(user.id, {
                display_name: displayName,
                bio,
                avatar_url: finalAvatarUrl,
                banner_url: bannerUrl,
                username: username || user.email?.split('@')[0], // Fallback or could be separate input
            });

            Alert.alert('Success', 'Profile updated successfully');
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to log out?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await signOut();
                            // Router replacement happens automatically via auth listener context usually, 
                            // but explicitly redirecting is safe.
                            router.replace('/(auth)/login');
                        } catch (error) {
                            console.error('Logout failed:', error);
                            Alert.alert('Error', 'Failed to log out');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-primary items-center justify-center">
                <ActivityIndicator size="large" color="#1DB954" />
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-primary">
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: 'Edit Profile',
                    headerTitleAlign: 'center',
                    headerStyle: { backgroundColor: '#121212' },
                    headerTintColor: '#fff',
                    headerShadowVisible: false,
                    headerBackButtonDisplayMode: 'minimal',
                    headerRight: () => (
                        <TouchableOpacity onPress={handleSave} disabled={saving} className="items-center justify-center w-8 h-8 ml-1.5">
                            {saving ? (
                                <ActivityIndicator size="small" color="#1DB954" />
                            ) : (
                                <Ionicons name="save-outline" size={24} color="#1DB954" />
                            )}
                        </TouchableOpacity>
                    ),
                }}
            />


            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {/* Banner Section */}
                    <TouchableOpacity
                        className="h-48 w-full bg-surface relative items-center justify-center"
                        onPress={() => setShowBannerModal(true)}
                    >
                        {bannerUrl ? (
                            <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <View className="items-center">
                                <Ionicons name="image-outline" size={32} color="#666" />
                                <Text className="text-text-secondary mt-2">Tap to set banner</Text>
                            </View>
                        )}
                        <View className="absolute bottom-2 right-2 bg-black/50 p-2 rounded-full">
                            <Ionicons name="pencil" size={16} color="#FFF" />
                        </View>
                    </TouchableOpacity>

                    {/* Avatar Section */}
                    <View className="items-center -mt-12 mb-6">
                        <TouchableOpacity
                            className="relative"
                            onPress={handlePickImage}
                        >
                            <View className="h-24 w-24 rounded-full border-4 border-primary bg-surface overflow-hidden items-center justify-center">
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                                ) : (
                                    <Ionicons name="person" size={40} color="#666" />
                                )}
                            </View>
                            <View className="absolute bottom-0 right-0 bg-accent p-2 rounded-full border-2 border-primary">
                                <Ionicons name="camera" size={14} color="#FFF" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Form Fields */}
                    <View className="px-4 space-y-4">
                        <View className="mb-4">
                            <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">Display Name</Text>
                            <TextInput
                                className="bg-surface text-text-primary p-4 rounded-lg border border-white/5"
                                placeholder="Your Name"
                                placeholderTextColor="#666"
                                value={displayName}
                                onChangeText={setDisplayName}
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">Username</Text>
                            <TextInput
                                className="bg-surface text-text-primary p-4 rounded-lg border border-white/5"
                                placeholder="username"
                                placeholderTextColor="#666"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">Bio</Text>
                            <TextInput
                                className="bg-surface text-text-primary p-4 rounded-lg border border-white/5 h-24"
                                placeholder="Tell us about yourself..."
                                placeholderTextColor="#666"
                                value={bio}
                                onChangeText={setBio}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>
                    </View>

                    <View className="px-4 mt-8">
                        <TouchableOpacity
                            className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg items-center justify-center flex-row space-x-2"
                            onPress={handleLogout}
                        >
                            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                            <Text className="text-red-500 font-bold text-base ml-2">Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <BannerSelectorModal
                visible={showBannerModal}
                onClose={() => setShowBannerModal(false)}
                onSelectBanner={setBannerUrl}
            />
        </View>
    );
}
