import { View, Text, TouchableOpacity, Alert, ScrollView, Image, RefreshControl, Share } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '~/hooks/useAuth';
import { useState, useEffect, useCallback } from 'react';
import { dbService } from '~/services/database';
import type { UserProfile } from '~/types';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';

export default function ProfileScreen() {
  const { user, signOut, isAuthenticated } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [watchedMovies, setWatchedMovies] = useState<any[]>([]);
  const [watchedSeries, setWatchedSeries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [userProfile, movies, series] = await Promise.all([
        dbService.getUserProfile(user.id),
        dbService.getWatchedMovies(user.id),
        dbService.getWatchedSeries(user.id),
      ]);
      setProfile(userProfile);
      setWatchedMovies(movies);
      setWatchedSeries(series);
    } catch (error) {
      console.error('Failed to load profile data', error);
    }
  }, [user]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadData();
      }
    }, [isAuthenticated, loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login' as any);
        },
      },
    ]);
  };

  const handleShare = async () => {
    const shareUrl = `https://kino.app/${profile?.username || user?.id}`;
    try {
      await Share.share({
        message: `Check out my Kino profile: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to share profile');
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-primary">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-4 text-xl font-bold text-text-primary">Profile</Text>
          <Text className="mb-6 text-center text-text-secondary">Log in to view your profile</Text>
          <TouchableOpacity
            className="rounded-lg bg-accent px-6 py-3"
            onPress={() => router.push('/login' as any)}>
            <Text className="font-semibold text-white">Log In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-primary">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />}
      >
        {/* Banner */}
        <View className="h-48 w-full bg-surface relative">
          {profile?.banner_url ? (
            <Image
              source={{ uri: profile.banner_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-gray-900 items-center justify-center">
              <Ionicons name="image-outline" size={48} color="#333" />
            </View>
          )}
          <View className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-primary to-transparent" />

          {/* Header Buttons */}
          <View className="absolute top-12 right-4 flex-row">
            <TouchableOpacity
              onPress={handleShare}
              className="bg-black/30 p-2 rounded-full mr-3"
            >
              <Ionicons name="share-social-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/profile/settings' as any)}
              className="bg-black/30 p-2 rounded-full"
            >
              <Ionicons name="settings-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View className="px-4 -mt-16 mb-8 items-center">
          <View className="rounded-full border-4 border-primary bg-surface overflow-hidden h-24 w-24 mb-4 items-center justify-center">
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
            ) : (
              <Ionicons name="person" size={40} color="#666" />
            )}
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-text-primary text-center">
              {profile?.display_name || profile?.username || user?.email?.split('@')[0]}
            </Text>
            {profile?.bio && (
              <Text className="text-text-secondary text-sm mt-1 text-center">{profile.bio}</Text>
            )}
            {profile?.username && (
              <Text className="text-text-secondary text-xs mt-1 text-center opacity-70">@{profile.username}</Text>
            )}
          </View>
        </View>

        {/* Watched Movies */}
        <View className="mb-8">
          <View className="px-4 flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-text-primary">Watched Movies</Text>
            <Text className="text-text-secondary text-xs">{watchedMovies.length}</Text>
          </View>

          {watchedMovies.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {watchedMovies.map(movie => (
                <TouchableOpacity
                  key={movie.user_rating_id}
                  className="mr-3 w-28"
                  onPress={() => router.push(`/title/${movie.tmdb_id}?type=movie` as any)}
                >
                  <Image
                    source={{ uri: movie.cover_image }}
                    className="w-28 h-40 rounded-lg mb-2 bg-surface"
                  />
                  <Text numberOfLines={1} className="text-text-primary font-medium text-xs">{movie.title}</Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={10} color="#EAB308" />
                    <Text className="text-text-secondary text-xs ml-1">{movie.rating}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text className="px-4 text-text-secondary italic">No movies watched yet.</Text>
          )}
        </View>

        {/* Watched Series */}
        <View className="mb-24">
          <View className="px-4 flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-text-primary">Watched Series</Text>
            <Text className="text-text-secondary text-xs">{watchedSeries.length}</Text>
          </View>

          {watchedSeries.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {watchedSeries.map(show => (
                <TouchableOpacity
                  key={show.id}
                  className="mr-3 w-28"
                  onPress={() => router.push(`/title/${show.tmdb_id}?type=tv` as any)}
                >
                  <Image
                    source={{ uri: show.cover_image }}
                    className="w-28 h-40 rounded-lg mb-2 bg-surface"
                  />
                  <Text numberOfLines={1} className="text-text-primary font-medium text-xs">{show.title}</Text>
                  <Text className="text-accent text-[10px]">
                    S{show.last_episode.season} E{show.last_episode.episode}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text className="px-4 text-text-secondary italic">No series watched yet.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
