import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTMDbService } from "~/services/tmdb";
import { dbService } from "~/services/database";
import { EpisodeActionModal } from "../modals/EpisodeActionModal";
import { RatingStars } from "~/components/common/RatingStars";
import { SeasonRatingModal } from "../modals/SeasonRatingModal";
import { useLanguage } from "@/hooks/useLanguage";
import type { TMDbSeason, TMDbEpisode, EpisodeRating } from "~/types";
import { useTranslation } from "react-i18next";
import { useFriendEpisodeRatings } from "~/hooks/data/useFriendRatings";
import { FriendEpisodeRatings } from "./FriendRatings";
import { formatDate, isFutureDateOnly } from "@kino/core";

interface SeasonSectionProps {
  tmdbId: number;
  titleId: string;
  numberOfSeasons: number;
  isAuthenticated: boolean;
  onLoginRequest: () => void;
  watchType: "first-time" | "rewatch";
}

export function SeasonSection({
  tmdbId,
  titleId,
  numberOfSeasons,
  isAuthenticated,
  onLoginRequest,
  watchType,
}: SeasonSectionProps) {
  const [seasons, setSeasons] = useState<
    Pick<TMDbSeason, "id" | "season_number" | "name">[]
  >([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<TMDbEpisode[]>([]);
  const [ratings, setRatings] = useState<Record<string, EpisodeRating>>({});
  const [loading, setLoading] = useState(true);
  const [seasonStats, setSeasonStats] = useState<{
    averageRating: number;
    ratedEpisodes: number;
  } | null>(null);
  const [selectedEpisodeForAction, setSelectedEpisodeForAction] =
    useState<TMDbEpisode | null>(null);
  const [showSeasonRatingModal, setShowSeasonRatingModal] = useState(false);
  const { t } = useTranslation();
  const language = useLanguage();

  const friendEpisodeQuery = useFriendEpisodeRatings(titleId, isAuthenticated);
  const allFriendEpisodeRatings = friendEpisodeQuery.data || [];

  const handleRateSeason = async (rating: number) => {
    if (selectedSeason === null) return;
    setLoading(true);
    const episodesToRate = episodes.filter(
      (ep) => !ratings[ep.episode_number]?.rating,
    );
    const promises = episodesToRate.map((ep) =>
      dbService.rateEpisode(
        titleId,
        selectedSeason,
        ep.episode_number,
        rating,
        ratings[ep.episode_number]?.watchType || "first-time",
        new Date(),
      ),
    );
    await Promise.all(promises);
    await loadSeasonDetails(selectedSeason);
    setLoading(false);
  };

  const loadSeasons = useCallback(async () => {
    try {
      const tabs = Array.from({ length: numberOfSeasons }, (_, i) => ({
        id: i + 1,
        season_number: i + 1,
        name: t("seasons.season", { number: i + 1 }),
      }));
      setSeasons(tabs);
    } catch (error) {
      console.error("Error init seasons", error);
    }
  }, [numberOfSeasons, t]);

  const loadSeasonDetails = useCallback(
    async (seasonNum: number) => {
      setLoading(true);
      try {
        const tmdb = getTMDbService();
        const season = await tmdb.getSeasonDetails(tmdbId, seasonNum);
        setEpisodes(season.episodes);

        if (isAuthenticated) {
          // Load user ratings (Batch Fetch)
          const userRatings = await dbService.getUserSeasonRatings(
            titleId,
            seasonNum,
          );

          const ratingsMap: Record<string, EpisodeRating> = {};
          let totalRating = 0;
          let ratedCount = 0; // Count of rated episodes for average
          let watchedCount = 0; // Count of watched episodes for progress

          userRatings.forEach((rating) => {
            ratingsMap[rating.episodeNumber] = rating;
            watchedCount++;
            if (rating.rating) {
              totalRating += rating.rating;
              ratedCount++;
            }
          });

          setRatings(ratingsMap);

          // Calculate season stats locally
          const averageRating = ratedCount > 0 ? totalRating / ratedCount : 0;

          setSeasonStats({
            averageRating,
            ratedEpisodes: watchedCount, // Display watched count as progress
          });
        }
      } catch (error) {
        Alert.alert(t("common.error"), t("seasons.loadSeasonDetailsError"));
      } finally {
        setLoading(false);
      }
    },
    [tmdbId, titleId, isAuthenticated, t],
  );

  useEffect(() => {
    loadSeasons();
  }, [loadSeasons]);

  // Find and set initial season
  useEffect(() => {
    const findInitialSeason = async () => {
      if (!isAuthenticated) {
        setSelectedSeason(1);
        return;
      }

      let targetSeason = 1;
      let allWatched = true;
      try {
        for (let i = 1; i <= numberOfSeasons; i++) {
          const tmdb = getTMDbService();
          const season = await tmdb.getSeasonDetails(tmdbId, i);
          const userRatings = await dbService.getUserSeasonRatings(titleId, i);

          if (userRatings.length < season.episodes.length) {
            targetSeason = i;
            allWatched = false;
            break;
          }
        }
        if (allWatched) {
          targetSeason = numberOfSeasons > 0 ? numberOfSeasons : 1;
        }
      } catch (error) {
        console.error("Error finding first unwatched season:", error);
      } finally {
        setSelectedSeason(targetSeason);
      }
    };

    findInitialSeason();
  }, [isAuthenticated, tmdbId, titleId, numberOfSeasons]);

  // This useEffect will load details when selectedSeason is set
  useEffect(() => {
    if (selectedSeason !== null) {
      loadSeasonDetails(selectedSeason);
    }
  }, [selectedSeason, loadSeasonDetails]);

  const handleRateEpisode = async (
    episodeNumber: number,
    rating: number | null,
    watchType: "first-time" | "rewatch",
  ) => {
    if (!isAuthenticated || selectedSeason === null) {
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
        new Date(),
      );

      // Refresh local state
      await loadSeasonDetails(selectedSeason);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t("seasons.updateRatingError"), message);
    }
  };

  const handleUnwatchEpisode = async (episodeNumber: number) => {
    if (selectedSeason === null) return;
    try {
      await dbService.removeEpisodeRating(
        titleId,
        selectedSeason,
        episodeNumber,
      );
      await loadSeasonDetails(selectedSeason);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t("common.error"), message);
    }
  };

  const toggleWatched = (episode: TMDbEpisode) => {
    if (!isAuthenticated) {
      onLoginRequest();
      return;
    }

    const isWatched = !!ratings[episode.episode_number];

    if (isWatched) {
      Alert.alert(
        t("seasons.markEpisodeUnwatched"),
        t("seasons.confirmUnwatchEpisode", { episodeName: episode.name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("seasons.unwatch"),
            style: "destructive",
            onPress: () => handleUnwatchEpisode(episode.episode_number),
          },
        ],
      );
    } else {
      setSelectedEpisodeForAction(episode);
    }
  };

  return (
    <View className="mt-6">
      <Text className="mb-4 text-xl font-bold text-text-primary">
        {t("seasons.title")}
      </Text>

      {/* Season Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4"
      >
        {seasons.map((season) => (
          <TouchableOpacity
            key={season.season_number}
            className={`mr-3 rounded-full px-4 py-2 ${selectedSeason === season.season_number
                ? "bg-accent"
                : "bg-surface"
              }`}
            onPress={() => setSelectedSeason(season.season_number)}
          >
            <Text
              className={`font-semibold ${selectedSeason === season.season_number
                  ? "text-primary"
                  : "text-text-secondary"
                }`}
            >
              {t("seasons.season", { number: season.season_number })}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mark Season Button */}
      {episodes.length > 0 && (
        <TouchableOpacity
          disabled={false}
          className={`mb-4 flex-row items-center justify-center rounded-lg py-3 ${seasonStats?.ratedEpisodes === episodes.length
              ? "border border-[#1DB954] bg-[#1DB954]"
              : "border border-accent bg-surface"
            }`}
          onPress={() => {
            if (!isAuthenticated) {
              onLoginRequest();
              return;
            }
            if (selectedSeason === null) return;
            const isWatched = seasonStats?.ratedEpisodes === episodes.length;

            Alert.alert(
              isWatched
                ? t("seasons.markSeasonUnwatched")
                : t("seasons.markSeasonWatched"),
              isWatched
                ? t("seasons.confirmUnwatchAll", { number: selectedSeason })
                : t("seasons.confirmWatchAll", { number: selectedSeason }),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: isWatched
                    ? t("seasons.markSeasonUnwatched")
                    : t("seasons.markSeasonWatched"),
                  style: isWatched ? "destructive" : "default",
                  onPress: async () => {
                    setLoading(true);
                    try {
                      if (isWatched) {
                        await dbService.removeSeasonEpisodesWatched(
                          titleId,
                          selectedSeason,
                        );
                      } else {
                        await dbService.markSeasonEpisodesAsWatched(
                          titleId,
                          selectedSeason,
                          episodes.map((e) => ({
                            season_number: selectedSeason,
                            episode_number: e.episode_number,
                          })),
                          watchType,
                        );
                      }
                      // Refresh stats/ratings
                      await loadSeasonDetails(selectedSeason);
                    } catch (error) {
                      Alert.alert(
                        t("common.error"),
                        t("seasons.markSeasonError", {
                          status: isWatched
                            ? t("seasons.notWatched")
                            : t("seasons.watched"),
                        }),
                      );
                    } finally {
                      setLoading(false);
                    }
                  },
                },
              ],
            );
          }}
        >
          <Ionicons
            name={
              seasonStats?.ratedEpisodes === episodes.length
                ? "checkmark-circle"
                : "checkmark-done-circle-outline"
            }
            size={20}
            color={
              seasonStats?.ratedEpisodes === episodes.length
                ? "white"
                : "#1DB954"
            }
          />
          <Text
            className={`ml-2 font-semibold ${seasonStats?.ratedEpisodes === episodes.length
                ? "text-white"
                : "text-[#1DB954]"
              }`}
          >
            {seasonStats?.ratedEpisodes === episodes.length
              ? t("seasons.watched")
              : t("seasons.markSeasonWatched")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Season Stats */}
      {loading ? (
        <View className="mb-4 h-20 w-full animate-pulse rounded-lg bg-surface/50" />
      ) : (
        seasonStats &&
        seasonStats.ratedEpisodes > 0 && (
          <View className="mb-4 flex-row items-center justify-between rounded-lg border border-black/50 bg-surface p-4">
            <View>
              <Text className="text-text-secondary">
                {t("seasons.seasonScore")}
              </Text>
              {seasonStats.averageRating > 0 ? (
                <Text className="text-2xl font-bold text-text-primary">
                  {seasonStats.averageRating.toFixed(1)}{" "}
                  <Text className="text-sm font-normal text-text-secondary">
                    / 5
                  </Text>
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (!isAuthenticated) {
                      onLoginRequest();
                      return;
                    }
                    setShowSeasonRatingModal(true);
                  }}
                >
                  <Text className="text-lg font-semibold text-green-500">
                    {t("seasons.addARate")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View>
              <Text className="text-text-secondary">
                {t("seasons.progress")}
              </Text>
              <Text className="font-medium text-text-primary">
                {t("seasons.episodesProgress", {
                  watched: seasonStats.ratedEpisodes,
                  total: episodes.length,
                })}
              </Text>
            </View>
          </View>
        )
      )}

      {loading ? (
        <View className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <View
              key={i}
              className="h-24 w-full animate-pulse rounded-lg bg-surface/50"
            />
          ))}
        </View>
      ) : (
        <View>
          {episodes.map((ep) => {
            const userRating = ratings[ep.episode_number];
            const isWatched = !!userRating;
            const hasAired = !isFutureDateOnly(ep.air_date);

            return (
              <View key={ep.id} className="mb-4 border-b border-surface pb-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-lg font-semibold text-text-primary">
                        {ep.episode_number}. {ep.name}
                      </Text>
                    </View>

                    {isWatched && (
                      <View className="mt-2">
                        <RatingStars
                          rating={userRating?.rating || 0}
                          size={16}
                          onRatingChange={() => setSelectedEpisodeForAction(ep)}
                          color="#1DB954"
                        />
                      </View>
                    )}

                    {/* Friend episode ratings */}
                    {selectedSeason !== null && (
                      <View className="mt-2">
                        <FriendEpisodeRatings
                          ratings={allFriendEpisodeRatings.filter(
                            (r) =>
                              r.seasonNumber === selectedSeason &&
                              r.episodeNumber === ep.episode_number
                          )}
                        />
                      </View>
                    )}

                    <Text className="mb-2 mt-4 text-xs text-text-secondary">
                      {ep.air_date
                        ? isFutureDateOnly(ep.air_date)
                        ? t("seasons.airsOn", {
                            date: formatDate(ep.air_date),
                          })
                          : formatDate(ep.air_date)
                        : "No date"}
                    </Text>
                    <Text
                      className="leading-5 text-text-secondary"
                      numberOfLines={3}
                    >
                      {ep.overview || t("seasons.noOverview")}
                    </Text>
                    {isWatched && userRating.watchedAt && (
                      <Text className="mt-2 text-xs text-accent">
                        {t("seasons.watchedOn")}{" "}
                        {formatDate(userRating.watchedAt)}
                      </Text>
                    )}
                  </View>
                  {hasAired ? (
                    <TouchableOpacity onPress={() => toggleWatched(ep)}>
                      <Ionicons
                        name={isWatched ? "eye" : "eye-off"}
                        size={28}
                        color={isWatched ? "#1DB954" : "#B0B0B0"}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 28 }} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
      {/* Episode Action Modal */}
      {selectedEpisodeForAction && selectedSeason !== null && (
        <EpisodeActionModal
          visible={!!selectedEpisodeForAction}
          onClose={() => setSelectedEpisodeForAction(null)}
          episodeNumber={selectedEpisodeForAction.episode_number}
          seasonNumber={selectedSeason}
          titleId={titleId}
          initialRating={
            ratings[selectedEpisodeForAction.episode_number]?.rating || 0
          }
          initialWatchType="first-time"
          onRate={(rating, watchType) =>
            handleRateEpisode(
              selectedEpisodeForAction.episode_number,
              rating,
              watchType,
            )
          }
        />
      )}

      {/* Season Rating Modal */}
      {selectedSeason !== null && (
        <SeasonRatingModal
          visible={showSeasonRatingModal}
          onClose={() => setShowSeasonRatingModal(false)}
          seasonNumber={selectedSeason}
          episodes={episodes}
          ratings={ratings}
          onRateEpisode={handleRateEpisode}
          onRateSeason={handleRateSeason}
        />
      )}
    </View>
  );
}
