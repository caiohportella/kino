// Title detail screen (movie or TV show)
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTMDbService } from '~/services/tmdb';
import { dbService } from '~/services/database';
import { transformMovieToTitleDetails, transformTVToTitleDetails } from '~/utils/tmdb-transform';
import { RatingStars } from '~/components/RatingStars';
import { StarBreakdown } from '~/components/StarBreakdown';
import { SeasonSection } from '~/components/SeasonSection';
import { CurtainLayout } from '~/components/CurtainLayout';
import { WatchlistSelectorModal } from '~/components/WatchlistSelectorModal';
import type { TitleDetails, MediaType, TitleRatingStats } from '~/types';
import { useAuth } from '~/hooks/useAuth';

export default function TitleDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: MediaType }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState<TitleDetails | null>(null);
  // Separate rating stats state to update independent of heavy title load
  const [stats, setStats] = useState<TitleRatingStats>({ averageRating: 0, totalRatings: 0, starBreakdown: {} });
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [watchType, setWatchType] = useState<'first-time' | 'rewatch'>('first-time');
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  const loadTitle = useCallback(async () => {
    if (!id || !type) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const tmdb = getTMDbService();
      const tmdbId = parseInt(id);

      let titleDetails: Omit<TitleDetails, 'averageRating' | 'ratingCount'>;

      if (type === 'movie') {
        const [movie, credits] = await Promise.all([
          tmdb.getMovieDetails(tmdbId),
          tmdb.getMovieCredits(tmdbId),
        ]);
        titleDetails = await transformMovieToTitleDetails(movie, credits);
      } else {
        const [tv, credits] = await Promise.all([
          tmdb.getTVDetails(tmdbId),
          tmdb.getTVCredits(tmdbId),
        ]);
        titleDetails = await transformTVToTitleDetails(tv, credits);
      }

      // Save to database and get stats
      let titleId = '';
      let titleStats: TitleRatingStats = { averageRating: 0, totalRatings: 0, starBreakdown: {} };

      try {
        titleId = await dbService.getOrCreateTitle({
          tmdbId: titleDetails.tmdbId,
          type: titleDetails.type,
          title: titleDetails.title,
          synopsis: titleDetails.synopsis,
          coverImage: titleDetails.coverImage,
          backdropImage: titleDetails.backdropImage,
          year: titleDetails.year,
          genres: titleDetails.genres,
          cast: titleDetails.cast,
          director: titleDetails.director,
          runtime: titleDetails.runtime,
          totalSeasons: titleDetails.totalSeasons,
        });

        titleStats = await dbService.getTitleRatingStats(titleId);
      } catch (error: any) {
        // If RLS error (anon user trying to insert new title), fail gracefully
        if (error?.code === '42501') {
          console.warn('Skipping title persistence for anonymous user (RLS policy)');
          // Use a nil UUID so subsequent queries (like season stats) validly return 0 rows instead of crashing
          titleId = '00000000-0000-0000-0000-000000000000';
        } else {
          throw error; // Rethrow other errors
        }
      }

      setStats(titleStats);

      const userRatingData = isAuthenticated && titleId !== '00000000-0000-0000-0000-000000000000'
        ? await dbService.getUserRating(titleId)
        : null;

      setTitle({
        ...titleDetails,
        id: titleId,
        averageRating: titleStats.averageRating,
        ratingCount: titleStats.totalRatings,
      });
      setUserRating(userRatingData?.rating || null);
      if (userRatingData?.watchType) setWatchType(userRatingData.watchType);

    } catch (error: any) {
      console.error('Error loading title:', error);
      const message = error instanceof Error ? error.message :
        (typeof error === 'object' && error?.message) ? error.message :
          'Failed to load title';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [id, type, isAuthenticated]);

  useEffect(() => {
    loadTitle();
  }, [loadTitle]);

  const handleRate = async (rating: number) => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please log in to rate titles');
      router.push('/login' as any);
      return;
    }

    if (!title) return;

    try {
      await dbService.rateTitle(title.id, rating, watchType, new Date());
      setUserRating(rating);

      // Update specific stats locally without fetching full title
      const newStats = await dbService.getTitleRatingStats(title.id);
      setStats(newStats);

      Alert.alert('Success', 'Rating saved!');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save rating');
    }
  };

  const handleShare = async () => {
    if (!title) return;
    try {
      await Share.share({
        message: `Check out ${title.title} on Kino!`,
      });
    } catch (error) {
      // ignore
    }
  };

  const handleAddToWatchlist = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please log in to add to your watchlist');
      router.push('/login' as any);
      return;
    }
    setShowWatchlistModal(true);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!title) {
    return (
      <View className="flex-1 items-center justify-center bg-primary p-4">
        <Text className="text-text-secondary">Title not found</Text>
      </View>
    );
  }

  return (
    <CurtainLayout>
      <Stack.Screen options={{
        headerShown: false,
        title: '',
        headerBackTitle: '', // Explicitly clear back button text
        headerBackTitleVisible: false,
        headerTransparent: false,
        headerTintColor: '#E0E0E0'
      } as any} />
      <ScrollView className="flex-1">
        {/* Hero Section */}
        <View className="relative">
          {title.backdropImage ? (
            <Image source={{ uri: title.backdropImage }} className="h-64 w-full" resizeMode="cover" />
          ) : (
            <View className="h-64 w-full bg-surface items-center justify-center">
              <Ionicons name="image-outline" size={48} color="#B0B0B0" />
            </View>
          )}
          <View className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-primary to-transparent" />
        </View>

        <View className="px-4 -mt-12 mb-6 flex-row items-end">
          {title.coverImage && (
            <Image
              source={{ uri: title.coverImage }}
              className="h-36 w-24 rounded-lg border-2 border-white shadow-md mr-4"
              resizeMode="cover"
            />
          )}
          <View className="flex-1 pb-2">
            <Text className="text-2xl font-bold text-text-primary" numberOfLines={2}>{title.title}</Text>
            <Text className="text-text-secondary font-medium">
              {title.year} • {title.genres.slice(0, 2).map(g => g.name).join(', ')}
            </Text>
          </View>
        </View>

        <View className="px-4">
          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center bg-accent rounded-lg py-3"
              onPress={handleAddToWatchlist}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Watchlist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-center bg-surface border border-accent rounded-lg px-4 py-3"
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#1DB954" />
            </TouchableOpacity>
          </View>

          {/* Synopsis */}
          <View className="mb-6">
            <Text className="text-base leading-6 text-text-primary">{title.synopsis}</Text>
          </View>

          {/* Cast & Director */}
          {(title.director || title.cast.length > 0) && (
            <View className="mb-6">
              <Text className="text-sm font-bold text-text-primary mb-2">CREDITS</Text>
              <View>
                {title.director && (
                  <Text className="text-text-secondary text-sm mb-1">
                    <Text className="font-semibold text-text-primary">Dir.</Text> {title.director.name}
                  </Text>
                )}
                {title.cast.length > 0 && (
                  <Text className="text-text-secondary text-sm">
                    <Text className="font-semibold text-text-primary">Cast:</Text> {title.cast.slice(0, 3).map(c => c.name).join(', ')}
                  </Text>
                )}
              </View>
            </View>
          )}

          <View className="h-[1px] bg-surface mb-6" />

          {/* Global Watch Status (Rewatch/First-Time) - MOVIE ONLY */}
          {title.type === 'movie' && (
            <View className="mb-6">
              <Text className="text-sm font-bold text-text-primary mb-2">WATCH STATUS</Text>
              <View className="flex-row rounded-lg bg-surface p-1 border border-black/50">
                <TouchableOpacity
                  className={`flex-1 items-center py-2 rounded-md ${watchType === 'first-time' ? 'bg-accent' : ''}`}
                  onPress={() => setWatchType('first-time')}
                >
                  <Text className={`font-medium ${watchType === 'first-time' ? 'text-white' : 'text-text-secondary'}`}>First Time</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 items-center py-2 rounded-md ${watchType === 'rewatch' ? 'bg-accent' : ''}`}
                  onPress={() => setWatchType('rewatch')}
                >
                  <Text className={`font-medium ${watchType === 'rewatch' ? 'text-white' : 'text-text-secondary'}`}>Rewatch</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Movie Specific Rating */}
          {title.type === 'movie' && (
            <View className="mb-6 p-4 bg-surface rounded-xl border border-black/50">
              <Text className="text-center font-bold text-lg mb-2 text-text-primary">Rate this Movie</Text>
              <View className="items-center">
                <RatingStars
                  rating={userRating || 0}
                  onRatingChange={handleRate}
                  size={32}
                />
                <Text className="text-text-secondary mt-2 text-sm">
                  {userRating ? 'Thanks for rating!' : 'Tap to rate'}
                </Text>
              </View>
            </View>
          )}

          {/* TV Specific Sections */}
          {title.type === 'tv' && title.totalSeasons && (
            <SeasonSection
              tmdbId={title.tmdbId}
              titleId={title.id}
              numberOfSeasons={title.totalSeasons}
              isAuthenticated={isAuthenticated}
              onLoginRequest={() => {
                Alert.alert('Login Required', 'Please log in.');
                router.push('/login' as any);
              }}
              watchType={watchType || 'first-time'}
            />
          )}

          {/* Community Stats */}
          <View className="mt-6 mb-8">
            <Text className="text-xl font-bold mb-4 text-text-primary">Community Ratings</Text>
            <View className="flex-row items-center mb-4">
              <Text className="text-4xl font-bold mr-4 text-text-primary">{stats.averageRating.toFixed(1)}</Text>
              <View>
                <RatingStars rating={stats.averageRating} readonly size={20} />
                <Text className="text-text-secondary text-sm mt-1">{stats.totalRatings} ratings</Text>
              </View>
            </View>
            <StarBreakdown stats={stats.starBreakdown} totalRatings={stats.totalRatings} />
          </View>
        </View>
      </ScrollView>

      <WatchlistSelectorModal
        visible={showWatchlistModal}
        onClose={() => setShowWatchlistModal(false)}
        titleId={title.id}
      />
    </CurtainLayout>
  );
}
