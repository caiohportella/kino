import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { dbService } from "~/services/database";
import type { TitleRatingStats } from "~/types";
import { RatingStars } from "../common/RatingStars";
import { StarBreakdown } from "../common/StarBreakdown";
import { Skeleton } from "../common/Skeleton";

interface CommunityStatsProps {
  titleId: string;
  type: "movie" | "tv";
  refreshKey?: number;
}

function CommunityStatsSkeleton() {
  const { t } = useTranslation();
  return (
    <View className="mb-8 mt-6">
      <Text className="mb-4 text-xl font-bold text-text-primary">
        {t("title.communityRatings")}
      </Text>
      <View className="mb-4 flex-row items-center">
        <Skeleton.Rect width={80} height={48} className="mr-4" />
        <View>
          <Skeleton.Rect width={110} height={20} />
          <Skeleton.Text width={100} className="mt-2" />
        </View>
      </View>
      <View className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <View key={i} className="flex-row items-center">
            <Skeleton.Text width={40} />
            <Skeleton.Rect width={"70%"} height={8} className="ml-2" />
          </View>
        ))}
      </View>
    </View>
  );
}

export function CommunityStats({
  titleId,
  type,
  refreshKey,
}: CommunityStatsProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<TitleRatingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        let fetchedStats: TitleRatingStats;
        if (type === "movie") {
          fetchedStats = await dbService.getTitleRatingStats(titleId);
        } else {
          fetchedStats = await dbService.getSeriesRatingStats(titleId);
        }
        setStats(fetchedStats);
      } catch (error) {
        console.error("Failed to fetch community stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [titleId, type, refreshKey]);

  if (loading) {
    return <CommunityStatsSkeleton />;
  }

  if (!stats || stats.totalRatings === 0) {
    return (
      <View className="mb-8 mt-6">
        <Text className="mb-4 text-xl font-bold text-text-primary">
          {t("title.communityRatings")}
        </Text>
        <Text className="text-text-secondary">{t("title.noRatingsYet")}</Text>
      </View>
    );
  }

  return (
    <View className="mb-8 mt-6">
      <Text className="mb-4 text-xl font-bold text-text-primary">
        {t("title.communityRatings")}
      </Text>
      <View className="mb-4 flex-row items-center">
        <Text className="mr-4 text-4xl font-bold text-text-primary">
          {stats.averageRating.toFixed(1)}
        </Text>
        <View>
          <RatingStars rating={stats.averageRating} readonly size={20} />
          <Text className="mt-1 text-sm text-text-secondary">
            {stats.totalRatings} {t("title.ratings")}
          </Text>
        </View>
      </View>
      <StarBreakdown
        stats={stats.starBreakdown}
        totalRatings={stats.totalRatings}
      />
    </View>
  );
}
