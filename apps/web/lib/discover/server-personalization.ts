import {
  KinoDatabaseService,
  TMDbService,
  type MediaType,
  type TMDbMovie,
  type TMDbTVShow,
  type TMDbTitle,
} from "@kino/core";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { getDiscoverAffinityData } from "./server-affinity";
import {
  buildPersonalizedDiscoverRails,
  DISCOVER_MIN_PERSONALIZED_RAIL_ITEMS,
  getDiscoverMediaKey,
  rankDiscoverRecommendations,
  selectDiscoverRecommendationSeeds,
  type DiscoverRecommendationBatch,
  type DiscoverRecommendationSeed,
  type PersonalizedDiscoverRail,
} from "./personalization";

function createPersonalizationTmdb(language: string) {
  const apiKey =
    process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY;

  if (!apiKey) {
    throw new Error("Missing TMDB API key.");
  }

  const tmdb = new TMDbService(apiKey);

  tmdb.setLanguage(language);

  return tmdb;
}

type RatedTitleJoin = {
  tmdb_id: number;
  type: MediaType;
};

type RatedTitleRow = {
  title: RatedTitleJoin | RatedTitleJoin[] | null;
};

type PersonalizedRecommendationData = {
  recommendations: TMDbTitle[];
  seed: (TMDbTitle & {
    media_type: "movie" | "tv";
  }) | null;
};

function unwrapJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function getRatedMediaKeys(userId: string) {
  const supabase = await createServerSupabaseClient();

  const [titleRatings, episodeRatings] = await Promise.all([
    supabase
      .from("title_ratings")
      .select("title:titles(tmdb_id,type)")
      .eq("user_id", userId)
      .not("rating", "is", null),

    supabase
      .from("episode_ratings")
      .select("title:titles(tmdb_id,type)")
      .eq("user_id", userId)
      .not("rating", "is", null),
  ]);

  if (titleRatings.error) {
    throw titleRatings.error;
  }

  if (episodeRatings.error) {
    throw episodeRatings.error;
  }

  const keys = new Set<string>();

  for (const row of [
    ...((titleRatings.data ?? []) as unknown as RatedTitleRow[]),
    ...((episodeRatings.data ?? []) as unknown as RatedTitleRow[]),
  ]) {
    const title = unwrapJoined(row.title);

    if (!title) {
      continue;
    }

    keys.add(getDiscoverMediaKey(title.type, title.tmdb_id));
  }

  return keys;
}

function normalizeSeedTitle(
  mediaType: "movie" | "tv",
  title: TMDbMovie | TMDbTVShow,
) {
  return {
    id: title.id,
    media_type: mediaType,
    title: mediaType === "movie" ? title.title : undefined,
    name: mediaType === "tv" ? title.name : undefined,
    overview: title.overview,
    poster_path: title.poster_path,
    backdrop_path: title.backdrop_path,
    release_date: mediaType === "movie" ? title.release_date : undefined,
    first_air_date:
      mediaType === "tv" ? title.first_air_date : undefined,
    vote_average: title.vote_average,
    vote_count: title.vote_count,
    genre_ids:
      "genres" in title && Array.isArray(title.genres)
        ? title.genres.map((genre) => genre.id)
        : [],
  } satisfies TMDbTitle & {
    media_type: "movie" | "tv";
  };
}

async function getSeedTitle(
  tmdb: TMDbService,
  seed: DiscoverRecommendationSeed,
) {
  try {
    if (seed.mediaType === "movie") {
      return normalizeSeedTitle("movie", await tmdb.getMovieDetails(seed.tmdbId));
    }

    return normalizeSeedTitle("tv", await tmdb.getTVDetails(seed.tmdbId));
  } catch (error) {
    console.error(
      "[discover:personalization] Failed to fetch personalized seed.",
      error,
    );

    return null;
  }
}

function selectStrongRecommendationSeed(
  seeds: DiscoverRecommendationSeed[],
  batches: DiscoverRecommendationBatch<TMDbTitle>[],
  excludedKeys: ReadonlySet<string>,
) {
  const batchesByKey = new Map(
    batches.map((batch) => [
      getDiscoverMediaKey(batch.seed.mediaType, batch.seed.tmdbId),
      batch,
    ]),
  );

  for (const seed of seeds) {
    const batch = batchesByKey.get(getDiscoverMediaKey(seed.mediaType, seed.tmdbId));

    if (!batch) {
      continue;
    }

    const items = rankDiscoverRecommendations(
      [batch],
      excludedKeys,
      DISCOVER_MIN_PERSONALIZED_RAIL_ITEMS,
    );

    if (items.length >= DISCOVER_MIN_PERSONALIZED_RAIL_ITEMS) {
      return seed;
    }
  }

  return null;
}

async function getPersonalizedRecommendationData(
  userId: string,
  language: string,
  limit = 20,
): Promise<PersonalizedRecommendationData> {
  const supabase = await createServerSupabaseClient();
  const database = new KinoDatabaseService(supabase);

  const diary = await database.getDiaryEntries(userId);

  if (diary.length === 0) {
    return {
      recommendations: [],
      seed: null,
    };
  }

  const candidates = diary.map((entry) => ({
    tmdbId: entry.tmdbId,
    mediaType: entry.type,
    rating: entry.rating ?? null,
    watchedAt: entry.watchedAt,
  }));

  const seeds = selectDiscoverRecommendationSeeds(candidates);

  if (seeds.length === 0) {
    return {
      recommendations: [],
      seed: null,
    };
  }

  const excludedKeys = new Set(
    diary.map((entry) => getDiscoverMediaKey(entry.type, entry.tmdbId)),
  );

  const ratedKeys = await getRatedMediaKeys(userId);

  for (const key of ratedKeys) {
    excludedKeys.add(key);
  }

  const tmdb = createPersonalizationTmdb(language);

  const recommendationResults = await Promise.allSettled(
    seeds.map(async (seed) => ({
      seed,
      items: await tmdb.getRecommendations(seed.mediaType, seed.tmdbId),
    })),
  );

  const batches = recommendationResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (batches.length === 0) {
    return {
      recommendations: [],
      seed: null,
    };
  }

  const recommendations = rankDiscoverRecommendations(
    batches,
    excludedKeys,
    limit,
  );

  const selectedSeed = selectStrongRecommendationSeed(
    seeds,
    batches,
    excludedKeys,
  );

  return {
    recommendations,
    seed: selectedSeed ? await getSeedTitle(tmdb, selectedSeed) : null,
  };
}

export async function getPersonalizedDiscoverRecommendations(
  userId: string,
  language: string,
  limit = 20,
): Promise<TMDbTitle[]> {
  const result = await getPersonalizedRecommendationData(userId, language, limit);

  return result.recommendations;
}

export async function getPersonalizedDiscoverRails(
  userId: string,
  language: string,
): Promise<PersonalizedDiscoverRail[]> {
  const [recommendationResult, affinityResult] = await Promise.allSettled([
    getPersonalizedRecommendationData(userId, language),
    getDiscoverAffinityData(userId, language),
  ]);

  return buildPersonalizedDiscoverRails({
    recommendationResult,
    affinityResult,
    logError(message, error) {
      console.error(message, error);
    },
  });
}
