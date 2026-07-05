import {
  View,
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/hooks/useAuth'
import { HomeSection } from '~/components/home/HomeSection'
import { useUserProfile } from '@/hooks/useDatabase'
import {
  useTrending,
  usePopularMovies,
  usePopularTV,
  useTopRatedMovies,
  useNowPlayingMovies,
  useUpcomingMovies,
  useOscarNominees,
} from '@/hooks/useTMDB'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)

  // Queries
  const { data: profile } = useUserProfile(user?.id)

  const trendingQuery = useTrending()
  const popularMoviesQuery = usePopularMovies()
  const popularTVQuery = usePopularTV()
  const topRatedQuery = useTopRatedMovies()
  const nowPlayingQuery = useNowPlayingMovies()
  const upcomingQuery = useUpcomingMovies()
  const oscarNomineesQuery = useOscarNominees()

  const isLoading =
    trendingQuery.isLoading ||
    popularMoviesQuery.isLoading ||
    popularTVQuery.isLoading ||
    topRatedQuery.isLoading ||
    nowPlayingQuery.isLoading ||
    upcomingQuery.isLoading ||
    oscarNomineesQuery.isLoading

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      trendingQuery.refetch(),
      popularMoviesQuery.refetch(),
      popularTVQuery.refetch(),
      topRatedQuery.refetch(),
      nowPlayingQuery.refetch(),
      upcomingQuery.refetch(),
      oscarNomineesQuery.refetch(),
    ])
    setRefreshing(false)
  }, [
    trendingQuery,
    popularMoviesQuery,
    popularTVQuery,
    topRatedQuery,
    nowPlayingQuery,
    upcomingQuery,
    oscarNomineesQuery,
  ])

  const handleAvatarPress = () => {
    if (user) {
      router.push('/(tabs)/profile')
    } else {
      router.push('/login')
    }
  }

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    )
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
            colors={['#1DB954']}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="pt-6">
          <HomeSection title={t('home.oscarMarathon')} data={oscarNomineesQuery.data || []} />
          <HomeSection title={t('home.trending')} data={trendingQuery.data || []} />
          <HomeSection title={t('home.popularMovies')} data={popularMoviesQuery.data || []} />
          <HomeSection title={t('home.popularTV')} data={popularTVQuery.data || []} />
          <HomeSection title={t('home.newReleases')} data={nowPlayingQuery.data || []} />
          <HomeSection title={t('home.topRated')} data={topRatedQuery.data || []} />
          <HomeSection title={t('home.comingSoon')} data={upcomingQuery.data || []} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
