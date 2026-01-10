import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTMDbService } from '~/services/tmdb';
import { dbService } from '~/services/database';
import { RatingStars } from './RatingStars';
import { EpisodeActionModal } from './EpisodeActionModal';
import type { TMDbSeason, TMDbEpisode, EpisodeRating } from '~/types';

interface SeasonSectionProps {
    tmdbId: number;
    titleId: string;
    numberOfSeasons: number;
    isAuthenticated: boolean;
    onLoginRequest: () => void;
    watchType: 'first-time' | 'rewatch';
}

export function SeasonSection({
    tmdbId,
    titleId,
    numberOfSeasons,
    isAuthenticated,
    onLoginRequest,
    watchType,
}: SeasonSectionProps) {
    const [seasons, setSeasons] = useState<TMDbSeason[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [episodes, setEpisodes] = useState<TMDbEpisode[]>([]);
    const [ratings, setRatings] = useState<Record<string, EpisodeRating>>({});
    const [loading, setLoading] = useState(false);
    const [seasonStats, setSeasonStats] = useState<{ averageRating: number; ratedEpisodes: number } | null>(null);
    const [selectedEpisodeForAction, setSelectedEpisodeForAction] = useState<TMDbEpisode | null>(null);

    const loadSeasons = useCallback(async () => {
        try {
            const tmdb = getTMDbService();
            const seasonsData: TMDbSeason[] = [];
            // Load first 5 seasons initially or logic to load all if needed
            // For now, let's just create array of season numbers or fetch minimally if possible
            // TMDb API doesn't give all season details in one go usually, but getTVDetails gave us number_of_seasons
            // modifying logic to just build simple tabs if we don't need full details for tabs yet

            // Actually we need details for the *selected* season.
            // Let's just mock the tab list based on number_of_seasons for now or fetch basic info if needed.
            // To be safe and show names, we might fetch season 1 details etc.
            // For performance, let's just generate numbers if names aren't critical or fetch on demand.

            const tabs = Array.from({ length: numberOfSeasons }, (_, i) => ({
                id: i + 1,
                season_number: i + 1,
                name: `Season ${i + 1}`,
            })) as any[];
            setSeasons(tabs);
        } catch (error) {
            console.error('Error init seasons', error);
        }
    }, [numberOfSeasons]);

    const loadSeasonDetails = useCallback(async (seasonNum: number) => {
        setLoading(true);
        try {
            const tmdb = getTMDbService();
            const season = await tmdb.getSeasonDetails(tmdbId, seasonNum);
            setEpisodes(season.episodes);

            if (isAuthenticated) {
                // Load user ratings
                const ratingsMap: Record<string, EpisodeRating> = {};
                for (const ep of season.episodes) {
                    const rating = await dbService.getUserEpisodeRating(titleId, seasonNum, ep.episode_number);
                    if (rating) {
                        ratingsMap[ep.episode_number] = rating;
                    }
                }
                setRatings(ratingsMap);

                // Load season stats
                const stats = await dbService.getSeasonRatingStats(titleId, seasonNum);
                setSeasonStats(stats);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to load season details');
        } finally {
            setLoading(false);
        }
    }, [tmdbId, titleId, isAuthenticated]);

    useEffect(() => {
        loadSeasons();
    }, [loadSeasons]);

    useEffect(() => {
        loadSeasonDetails(selectedSeason);
    }, [selectedSeason, loadSeasonDetails]);

    const handleRateEpisode = async (episodeNumber: number, rating: number, watchType: 'first-time' | 'rewatch') => {
        if (!isAuthenticated) {
            onLoginRequest();
            return;
        }

        try {
            await dbService.rateEpisode(
                titleId,
                selectedSeason,
                episodeNumber,
                rating,
                watchType,
                new Date()
            );

            // Refresh local state
            const newRating = await dbService.getUserEpisodeRating(titleId, selectedSeason, episodeNumber);
            if (newRating) {
                setRatings(prev => ({ ...prev, [episodeNumber]: newRating }));
            }

            // Refresh stats
            const stats = await dbService.getSeasonRatingStats(titleId, selectedSeason);
            setSeasonStats(stats);

        } catch (error) {
            Alert.alert('Error', 'Failed to save rating');
        }
    };

    const toggleWatched = (episode: TMDbEpisode) => {
        if (!isAuthenticated) {
            onLoginRequest();
            return;
        }
        setSelectedEpisodeForAction(episode);
    };

    return (
        <View className="mt-6">
            <Text className="mb-4 text-xl text-text-primary font-bold">Seasons & Episodes</Text>

            {/* Season Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {seasons.map((season) => (
                    <TouchableOpacity
                        key={season.season_number}
                        className={`mr-3 rounded-full px-4 py-2 ${selectedSeason === season.season_number ? 'bg-accent' : 'bg-surface'
                            }`}
                        onPress={() => setSelectedSeason(season.season_number)}>
                        <Text
                            className={`font-semibold ${selectedSeason === season.season_number ? 'text-primary' : 'text-text-secondary'
                                }`}>
                            Season {season.season_number}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Season Stats */}
            {seasonStats && seasonStats.ratedEpisodes > 0 && (
                <View className="mb-4 flex-row items-center justify-between rounded-lg bg-surface p-4 border border-black/50">
                    <View>
                        <Text className="text-text-secondary">Season Score</Text>
                        <Text className="text-2xl font-bold text-text-primary">{seasonStats.averageRating.toFixed(1)} <Text className="text-sm font-normal text-text-secondary">/ 5</Text></Text>
                    </View>
                    <View>
                        <Text className="text-text-secondary">Progress</Text>
                        <Text className="font-medium text-text-primary">{seasonStats.ratedEpisodes} / {episodes.length} episodes</Text>
                    </View>
                </View>
            )}

            {loading ? (
                <ActivityIndicator className="py-8" color="#1DB954" />
            ) : (
                <View>
                    {episodes.map((ep) => {
                        const userRating = ratings[ep.episode_number];
                        const isWatched = !!userRating;

                        return (
                            <View key={ep.id} className="mb-4 border-b border-surface pb-4">
                                <View className="flex-row items-start justify-between">
                                    <View className="flex-1 pr-4">
                                        <Text className="font-semibold text-lg text-text-primary">{ep.episode_number}. {ep.name}</Text>
                                        <Text className="text-xs text-text-secondary mb-2">{ep.air_date ? new Date(ep.air_date).toLocaleDateString() : 'No date'}</Text>
                                        <Text className="text-text-secondary leading-5" numberOfLines={3}>{ep.overview || 'No overview available.'}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => toggleWatched(ep)}>
                                        <Ionicons
                                            name={isWatched ? "eye" : "eye-off"}
                                            size={28}
                                            color={isWatched ? "#1DB954" : "#B0B0B0"}
                                        />
                                    </TouchableOpacity>
                                </View>

                                <View className="mt-3 flex-row items-center justify-between">
                                    <RatingStars
                                        rating={userRating?.rating || 0}
                                        onRatingChange={(r) => handleRateEpisode(ep.episode_number, r, watchType)}
                                        size={20}
                                    />
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
            {/* Episode Action Modal */}
            {selectedEpisodeForAction && (
                <EpisodeActionModal
                    visible={!!selectedEpisodeForAction}
                    onClose={() => setSelectedEpisodeForAction(null)}
                    episodeNumber={selectedEpisodeForAction.episode_number}
                    seasonNumber={selectedSeason}
                    titleId={titleId}
                    initialRating={ratings[selectedEpisodeForAction.episode_number]?.rating || 0}
                    initialWatchType="first-time"
                    onRate={async (rating, watchType) => {
                        await handleRateEpisode(selectedEpisodeForAction.episode_number, rating, watchType);
                    }}
                />
            )}
        </View>
    );
}
