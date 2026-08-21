import type { TMDbTitle } from "@kino/core";

import type { DiscoverAffinityRow } from "./affinity-credits";

export type DiscoverSeedCandidate = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  rating: number | null;
  watchedAt: string | null;
};

export type DiscoverRecommendationSeed = {
  tmdbId: number;
  mediaType: "movie" | "tv";
};

export const DISCOVER_MAX_RECOMMENDATION_SEEDS = 6;
export const DISCOVER_PREFERRED_RATING = 4;
export const DISCOVER_MIN_PERSONALIZED_RAIL_ITEMS = 8;
export const DISCOVER_MIN_AFFINITY_RAIL_ITEMS = 6;
export const DISCOVER_MAX_PERSONALIZED_RAILS = 2;

type DiscoverRecommendationItem = {
  id: number;
  media_type?: "movie" | "tv";
  vote_average?: number;
  vote_count?: number;
};

export type DiscoverRecommendationBatch<T extends DiscoverRecommendationItem> =
  {
    seed: DiscoverRecommendationSeed;
    items: T[];
  };

export const DISCOVER_RECOMMENDATION_LIMIT = 20;

export type PersonalizedDiscoverRail =
  | {
      kind: "because-you-liked";
      seed: TMDbTitle & {
        media_type: "movie" | "tv";
      };
      items: TMDbTitle[];
    }
  | {
      kind: "affinity";
      affinityKind: DiscoverAffinityRow["kind"];
      source: DiscoverAffinityRow["source"];
      items: TMDbTitle[];
    };

export function getDiscoverMediaKey(mediaType: "movie" | "tv", tmdbId: number) {
  return `${mediaType}:${tmdbId}`;
}

export function rankDiscoverRecommendations<
  T extends DiscoverRecommendationItem,
>(
  batches: DiscoverRecommendationBatch<T>[],
  watchedKeys: ReadonlySet<string>,
  limit = DISCOVER_RECOMMENDATION_LIMIT,
): T[] {
  const ranked = new Map<
    string,
    {
      item: T;
      score: number;
      firstSeen: number;
    }
  >();

  let firstSeen = 0;

  batches.forEach((batch, batchIndex) => {
    batch.items.forEach((item, itemIndex) => {
      const mediaType = item.media_type ?? batch.seed.mediaType;

      const key = getDiscoverMediaKey(mediaType, item.id);

      if (watchedKeys.has(key)) {
        return;
      }

      const normalized = {
        ...item,
        media_type: mediaType,
      } as T;

      /*
       * Main signal: agreement between independent seed
       * recommendation lists.
       *
       * Seed order adds a small preference toward titles the
       * user rated more highly, because seeds are already
       * ordered by selectDiscoverRecommendationSeeds().
       *
       * TMDb result position is only a tiny tie-break signal.
       */
      const seedBonus = (batches.length - batchIndex) * 0.1;

      const positionBonus = Math.max(0, 20 - itemIndex) * 0.001;

      const scoreIncrement = 1 + seedBonus + positionBonus;

      const existing = ranked.get(key);

      if (existing) {
        existing.score += scoreIncrement;
        return;
      }

      ranked.set(key, {
        item: normalized,
        score: scoreIncrement,
        firstSeen: firstSeen++,
      });
    });
  });

  return [...ranked.values()]
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      const ratingDifference =
        (b.item.vote_average ?? 0) - (a.item.vote_average ?? 0);

      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      const voteDifference =
        (b.item.vote_count ?? 0) - (a.item.vote_count ?? 0);

      if (voteDifference !== 0) {
        return voteDifference;
      }

      return a.firstSeen - b.firstSeen;
    })
    .slice(0, limit)
    .map(({ item }) => item);
}

function timestamp(value: string | null) {
  if (!value) return 0;

  const time = Date.parse(value);

  return Number.isFinite(time) ? time : 0;
}

export function selectDiscoverRecommendationSeeds(
  candidates: DiscoverSeedCandidate[],
  limit = DISCOVER_MAX_RECOMMENDATION_SEEDS,
): DiscoverRecommendationSeed[] {
  const unique = new Map<string, DiscoverSeedCandidate>();

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.tmdbId) || candidate.tmdbId <= 0) {
      continue;
    }

    const key = `${candidate.mediaType}:${candidate.tmdbId}`;
    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, candidate);
      continue;
    }

    const existingRating = existing.rating ?? 0;
    const candidateRating = candidate.rating ?? 0;

    if (
      candidateRating > existingRating ||
      (candidateRating === existingRating &&
        timestamp(candidate.watchedAt) > timestamp(existing.watchedAt))
    ) {
      unique.set(key, candidate);
    }
  }

  const values = [...unique.values()];

  const preferred = values
    .filter(
      (candidate) =>
        candidate.rating !== null &&
        candidate.rating >= DISCOVER_PREFERRED_RATING,
    )
    .sort((a, b) => {
      const ratingDifference = (b.rating ?? 0) - (a.rating ?? 0);

      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      return timestamp(b.watchedAt) - timestamp(a.watchedAt);
    });

  const preferredKeys = new Set(
    preferred.map((candidate) => `${candidate.mediaType}:${candidate.tmdbId}`),
  );

  const recentFallback = values
    .filter(
      (candidate) =>
        !preferredKeys.has(`${candidate.mediaType}:${candidate.tmdbId}`),
    )
    .sort((a, b) => timestamp(b.watchedAt) - timestamp(a.watchedAt));

  return [...preferred, ...recentFallback]
    .slice(0, limit)
    .map(({ tmdbId, mediaType }) => ({
      tmdbId,
      mediaType,
    }));
}

function getPersonalizedAffinityPriority(row: DiscoverAffinityRow) {
  return (
    row.source.score * 100 +
    row.source.averageRating * 10 +
    row.source.titleCount +
    row.items.length * 0.01
  );
}

function selectStrongestAffinityRow(rows: DiscoverAffinityRow[]) {
  return [...rows]
    .filter((row) => row.items.length >= DISCOVER_MIN_AFFINITY_RAIL_ITEMS)
    .sort(
      (left, right) =>
        getPersonalizedAffinityPriority(right) -
          getPersonalizedAffinityPriority(left) ||
        right.source.score - left.source.score ||
        right.source.averageRating - left.source.averageRating ||
        right.source.titleCount - left.source.titleCount ||
        right.items.length - left.items.length ||
        left.kind.localeCompare(right.kind) ||
        left.source.id - right.source.id,
    )[0] ?? null;
}

export function selectPersonalizedDiscoverRails({
  recommendations,
  seed,
  affinityRows,
  limit = DISCOVER_MAX_PERSONALIZED_RAILS,
}: {
  recommendations: TMDbTitle[];
  seed: (TMDbTitle & { media_type: "movie" | "tv" }) | null;
  affinityRows: DiscoverAffinityRow[];
  limit?: number;
}): PersonalizedDiscoverRail[] {
  const normalizedLimit = Math.max(0, Math.floor(limit));

  if (normalizedLimit === 0) {
    return [];
  }

  const rails: PersonalizedDiscoverRail[] = [];

  if (
    seed &&
    recommendations.length >= DISCOVER_MIN_PERSONALIZED_RAIL_ITEMS
  ) {
    rails.push({
      kind: "because-you-liked",
      seed,
      items: recommendations,
    });
  }

  if (rails.length >= normalizedLimit) {
    return rails.slice(0, normalizedLimit);
  }

  const affinityRow = selectStrongestAffinityRow(affinityRows);

  if (affinityRow) {
    rails.push({
      kind: "affinity",
      affinityKind: affinityRow.kind,
      source: affinityRow.source,
      items: affinityRow.items,
    });
  }

  return rails.slice(0, normalizedLimit);
}
