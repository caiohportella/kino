import Link from "next/link";

import { DiscoverClient } from "@/components/discover/discover-client";
import { EmptyState } from "@/components/kino";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  getRequestLanguage,
  getTranslations,
} from "@/lib/localization/server-localization";
import { getDiscoverData, getRegionForLanguage } from "@/lib/tmdb/server-tmdb";
import { cn } from "@/lib/utils";
import { getPersonalizedDiscoverRails } from "@/lib/discover/server-personalization";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPersonalizedSeriesUpdates } from "@/lib/discover/server-series-updates";
import {
  DiscoverAffinityData,
  getDiscoverAffinityData,
} from "@/lib/discover/server-affinity";
import {
  buildPersonalizedNewReleases,
  buildPersonalizedNewSeries,
} from "@/lib/discover/server-release-relevance";
import { getDiscoverDateWindow } from "@/lib/discover/feed-dates";
import {
  getRecentSeriesReleases,
  getRelatedReleaseSignals,
  getRelatedSeriesSignals,
} from "@/lib/discover/server-related-releases";

export default async function DiscoverPage() {
  const language = await getRequestLanguage();
  const t = await getTranslations(language);

  const region = getRegionForLanguage(language);

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const emptyAffinityData: DiscoverAffinityData = {
    rows: [],
    candidates: {
      actors: [],
      directors: [],
      studios: [],
    },
  };

  try {
    const [data, personalizedRails, seriesUpdates, affinityData] = await Promise.all([
      getDiscoverData(language, region),

      user
        ? getPersonalizedDiscoverRails(user.id, language).catch(
            (error) => {
              console.error(
                "[discover:personalization] Failed to build personalized rails.",
                error,
              );

              return [];
            },
          )
        : Promise.resolve([]),

      user
        ? getPersonalizedSeriesUpdates(user.id, language).catch((error) => {
            console.error(
              "[discover:series-updates] Failed to build series updates.",
              error,
            );

            return [];
          })
        : Promise.resolve([]),

      user
        ? getDiscoverAffinityData(user.id, language).catch((error) => {
            console.error(
              "[discover:affinity] Failed to build affinity data.",
              error,
            );

            return emptyAffinityData;
          })
        : Promise.resolve(emptyAffinityData),
    ]);

    const forYou =
      personalizedRails.find((rail) => rail.kind === "because-you-liked")?.items ??
      [];

    const { today, recentStart } = getDiscoverDateWindow();

    const recentWindow = {
      start: recentStart,
      end: today,
    };

    const [relatedReleases, genericNewSeries, relatedSeries] =
      await Promise.all([
        user
          ? getRelatedReleaseSignals({
              affinityCandidates: affinityData.candidates,
              language,
              region,
              window: recentWindow,
            }).catch((error) => {
              console.error(
                "[discover:releases] Failed to build related release signals.",
                error,
              );

              return [];
            })
          : Promise.resolve([]),

        getRecentSeriesReleases({
          language,
          window: recentWindow,
        }).catch((error) => {
          console.error(
            "[discover:series-releases] Failed to fetch recent series.",
            error,
          );

          return [];
        }),

        user
          ? getRelatedSeriesSignals({
              affinityCandidates: affinityData.candidates,
              language,
              window: recentWindow,
            }).catch((error) => {
              console.error(
                "[discover:series-releases] Failed to build related series signals.",
                error,
              );

              return [];
            })
          : Promise.resolve([]),
      ]);

    const personalizedNewReleases = buildPersonalizedNewReleases({
      newReleases: data.newReleases,
      forYou,
      relatedReleases,
    });

    const personalizedNewSeries = buildPersonalizedNewSeries({
      newSeries: genericNewSeries,
      forYou,
      relatedSeries,
    });
    
    return (
      <div className="content-frame">
        <PageHeader size="wide" title={t("tabs.home")} />

        <DiscoverClient
          genres={data.genres}
          movieGenres={data.movieGenres}
          personalizedRails={personalizedRails}
          personalizedNewReleases={personalizedNewReleases}
          personalizedNewSeries={personalizedNewSeries}
          popularMovies={data.popularMovies}
          popularTV={data.popularTV}
          region={region}
          rereleases={data.rereleases}
          seriesUpdates={seriesUpdates}
          trending={data.trending}
          tvGenres={data.tvGenres}
          upcoming={data.upcoming}
        />
      </div>
    );
  } catch (error) {
    return (
      <EmptyState
        action={
          <Link
            className={cn(buttonVariants({ variant: "secondary" }))}
            href="/discover"
          >
            {t("common.tryAgain")}
          </Link>
        }
        body={error instanceof Error ? error.message : "TMDB did not respond."}
        illustrationLabel={t("emptyStates.missingIllustration")}
        title={t("common.failed")}
        variant="missing"
      />
    );
  }
}
