// Episode tracking screen for TV shows
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getTMDbService } from '~/services/tmdb';
import { dbService } from '~/services/database';
import { RatingStars } from '~/components/RatingStars';
import { useAuth } from '~/hooks/useAuth';
import { CurtainLayout } from '~/components/CurtainLayout';
import type { TMDbEpisode, TMDbSeason, EpisodeRating } from '~/types';

export default function EpisodesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [seasons, setSeasons] = useState<TMDbSeason[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, TMDbEpisode[]>>({});
  const [ratings, setRatings] = useState<Record<string, EpisodeRating>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [watchType, setWatchType] = useState<'first-time' | 'rewatch'>('first-time');

  const loadSeasons = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const tmdb = getTMDbService();
      const tvId = parseInt(id);
      const tvDetails = await tmdb.getTVDetails(tvId);

      const seasonsData: TMDbSeason[] = [];
      for (let i = 1; i <= tvDetails.number_of_seasons; i++) {
        try {
          const season = await tmdb.getSeasonDetails(tvId, i);
          seasonsData.push(season);
        } catch (error) {
          console.error(`Error loading season ${i}:`, error);
        }
      }

      setSeasons(seasonsData);
      if (seasonsData.length > 0) {
        setSelectedSeason(1);
      }
    } catch {
      Alert.alert('Error', 'Failed to load seasons');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadEpisodes = useCallback(
    async (seasonNumber: number) => {
      if (!id) return;

      try {
        const tmdb = getTMDbService();
        const tvId = parseInt(id);
        const season = await tmdb.getSeasonDetails(tvId, seasonNumber);

        setEpisodes((prev) => ({
          ...prev,
          [seasonNumber]: season.episodes,
        }));

        // Load user ratings for this season
        if (isAuthenticated) {
          const title = await dbService.getTitleByTmdbId(tvId);
          if (title) {
            const seasonEpisodes = season.episodes;
            const ratingsMap: Record<string, EpisodeRating> = {};

            for (const episode of seasonEpisodes) {
              const rating = await dbService.getUserEpisodeRating(
                title.id,
                seasonNumber,
                episode.episode_number
              );
              if (rating) {
                ratingsMap[`${seasonNumber}-${episode.episode_number}`] = rating;
              }
            }

            setRatings((prev) => ({ ...prev, ...ratingsMap }));
          }
        }
      } catch {
        Alert.alert('Error', 'Failed to load episodes');
      }
    },
    [id, isAuthenticated]
  );

  useEffect(() => {
    if (id) {
      loadSeasons();
    }
  }, [id, loadSeasons]);

  useEffect(() => {
    if (selectedSeason && id) {
      loadEpisodes(selectedSeason);
    }
  }, [selectedSeason, id, loadEpisodes]);

  const handleRateEpisode = async (seasonNumber: number, episodeNumber: number, rating: number) => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please log in to rate episodes');
      router.push('/login' as any);
      return;
    }

    if (!id) return;

    try {
      const tvId = parseInt(id);
      const title = await dbService.getTitleByTmdbId(tvId);

      if (!title) {
        Alert.alert('Error', 'Title not found in database');
        return;
      }

      await dbService.rateEpisode(
        title.id,
        seasonNumber,
        episodeNumber,
        rating,
        watchType,
        new Date()
      );

      // Update local state
      const key = `${seasonNumber}-${episodeNumber}`;
      setRatings((prev) => ({
        ...prev,
        [key]: {
          id: key,
          userId: '',
          titleId: title.id,
          seasonNumber,
          episodeNumber,
          rating,
          watchType,
          watchedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }));

      Alert.alert('Success', 'Episode rated!');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to rate episode');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (seasons.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-4">
        <Text className="text-gray-600">No seasons available</Text>
      </View>
    );
  }

  const currentEpisodes = selectedSeason ? episodes[selectedSeason] || [] : [];

  return (
    <CurtainLayout>
      <View className="flex-1 bg-gray-50">
        <Stack.Screen options={{ headerShown: false }} />
        {/* Season Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-200 bg-white">
          <View className="flex-row px-4 py-2">
            {seasons.map((season) => (
              <TouchableOpacity
                key={season.id}
                className={`mr-2 rounded-lg px-4 py-2 ${selectedSeason === season.season_number ? 'bg-black' : 'bg-gray-100'
                  }`}
                onPress={() => setSelectedSeason(season.season_number)}>
                <Text
                  className={`font-medium ${selectedSeason === season.season_number ? 'text-white' : 'text-gray-700'
                    }`}>
                  {season.name || `Season ${season.season_number}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Watch Type Selector */}
        <View className="flex-row gap-2 border-b border-gray-200 bg-white p-4">
          <TouchableOpacity
            className={`flex-1 rounded-lg px-4 py-2 ${watchType === 'first-time' ? 'bg-black' : 'bg-gray-100'
              }`}
            onPress={() => setWatchType('first-time')}>
            <Text
              className={`text-center font-medium ${watchType === 'first-time' ? 'text-white' : 'text-gray-700'
                }`}>
              First Time
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-lg px-4 py-2 ${watchType === 'rewatch' ? 'bg-black' : 'bg-gray-100'
              }`}
            onPress={() => setWatchType('rewatch')}>
            <Text
              className={`text-center font-medium ${watchType === 'rewatch' ? 'text-white' : 'text-gray-700'
                }`}>
              Rewatch
            </Text>
          </TouchableOpacity>
        </View>

        {/* Episodes List */}
        <ScrollView className="flex-1">
          {currentEpisodes.map((episode) => {
            const ratingKey = `${selectedSeason}-${episode.episode_number}`;
            const userRating = ratings[ratingKey];

            return (
              <View key={episode.id} className="mb-2 border-b border-gray-100 bg-white p-4">
                <View className="mb-2 flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="mb-1 text-lg font-semibold">
                      {episode.episode_number}. {episode.name}
                    </Text>
                    {episode.air_date && (
                      <Text className="mb-2 text-sm text-gray-600">
                        {new Date(episode.air_date).toLocaleDateString()}
                      </Text>
                    )}
                    {episode.overview && (
                      <Text className="mb-3 text-sm text-gray-700" numberOfLines={3}>
                        {episode.overview}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="mb-2">
                  <Text className="mb-2 text-sm font-medium">Your Rating</Text>
                  <RatingStars
                    rating={userRating?.rating || 0}
                    onRatingChange={(rating) =>
                      handleRateEpisode(selectedSeason!, episode.episode_number, rating)
                    }
                    showValue
                  />
                </View>

                {episode.vote_average > 0 && (
                  <View className="flex-row items-center">
                    <Text className="text-xs text-gray-600">
                      Community: ⭐ {episode.vote_average.toFixed(1)} ({episode.vote_count} ratings)
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </CurtainLayout>
  );
}
