import { View, ScrollView, RefreshControl, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getTMDbService } from '~/services/tmdb';
import { dbService } from '~/services/database';
import { useAuth } from '~/hooks/useAuth';
import { HomeSection } from '~/components/HomeSection';
import type { TMDbTitle, UserProfile } from '~/types';

const tmdb = getTMDbService();

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Data States
  const [trending, setTrending] = useState<TMDbTitle[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDbTitle[]>([]);
  const [popularTV, setPopularTV] = useState<TMDbTitle[]>([]);
  const [topRated, setTopRated] = useState<TMDbTitle[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TMDbTitle[]>([]);
  const [upcoming, setUpcoming] = useState<TMDbTitle[]>([]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use useEffect for initial data load to avoid double fetch on focus if data exists
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch Profile separately on auth change
  useEffect(() => {
    if (user) {
      dbService.getUserProfile(user.id).then(setProfile);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [
        trendingRes,
        popMoviesRes,
        popTVRes,
        topRatedRes,
        nowPlayingRes,
        upcomingRes
      ] = await Promise.all([
        tmdb.getTrending('all', 'day'),
        tmdb.getPopularMovies(),
        tmdb.getPopularTV(),
        tmdb.getTopRatedMovies(),
        tmdb.getNowPlayingMovies(),
        tmdb.getUpcomingMovies()
      ]);

      setTrending(trendingRes);
      setPopularMovies(popMoviesRes);
      setPopularTV(popTVRes);
      setTopRated(topRatedRes);
      setNowPlaying(nowPlayingRes);
      setUpcoming(upcomingRes);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleAvatarPress = () => {
    // Navigate to profile or login
    if (user) {
      router.push('/(tabs)/profile');
    } else {
      router.push('/login' as any);
    }
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-primary">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-white/5 bg-primary z-10">
        <View>
          <Text className="text-3xl font-black text-white italic tracking-tighter">
            KINO<Text className="text-accent">.</Text>
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleAvatarPress}
          className="h-10 w-10 rounded-full bg-surface items-center justify-center overflow-hidden border border-white/10"
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
          ) : (
            <Ionicons name="person" size={20} color="#666" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >

        {/* Featured / Trending Hero Replacement could go here, for now using rows */}
        <View className="pt-6">
          <HomeSection title="Trending Today" data={trending} />
          <HomeSection title="Popular Movies" data={popularMovies} />
          <HomeSection title="TV Shows We Love" data={popularTV} />
          <HomeSection title="New Releases" data={nowPlaying} />
          <HomeSection title="Top Rated Movies" data={topRated} />
          <HomeSection title="Coming Soon" data={upcoming} />
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}
