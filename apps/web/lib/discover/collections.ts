export type DiscoverCollectionId =
  | "hidden-gems"
  | "quick-watch"
  | "90s-essentials"
  | "modern-classics"
  | "critically-acclaimed"
  | "something-weird"
  | "new-this-month";

type MediaType = "movie" | "tv";

type DiscoverCollectionCriteria = {
  genres?: number[];
  voteAverageGte?: number;
  voteCountGte?: number;
  popularityGte?: number;
  popularityLte?: number;
  runtimeLte?: number;
  releaseDateGte?: string;
  releaseDateLte?: string;
  firstAirDateGte?: string;
  firstAirDateLte?: string;
  sortBy?: string;
  includeAdult?: boolean;
  includeVideo?: boolean;
  includeNullFirstAirDates?: boolean;
};

type DiscoverCollectionDefinition = {
  id: DiscoverCollectionId;
  titleKey: string;
  descriptionKey: string;
  criteria: Partial<Record<MediaType, DiscoverCollectionCriteria>>;
};

export type DiscoverCollection = DiscoverCollectionDefinition;

export type DiscoverCollectionFilters = {
  mediaType: "all" | "movie" | "tv";
  genreIds: number[];
  minRating: number;
};

const COLLECTIONS: Record<DiscoverCollectionId, DiscoverCollectionDefinition> = {
  "hidden-gems": {
    id: "hidden-gems",
    titleKey: "discover.collections.hiddenGems.title",
    descriptionKey: "discover.collections.hiddenGems.description",
    criteria: {
      movie: {
        voteAverageGte: 7.1,
        voteCountGte: 250,
        popularityLte: 45,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeVideo: false,
      },
      tv: {
        voteAverageGte: 7.1,
        voteCountGte: 250,
        popularityLte: 45,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeNullFirstAirDates: false,
      },
    },
  },
  "quick-watch": {
    id: "quick-watch",
    titleKey: "discover.collections.quickWatch.title",
    descriptionKey: "discover.collections.quickWatch.description",
    criteria: {
      movie: {
        runtimeLte: 100,
        voteAverageGte: 6.6,
        voteCountGte: 150,
        popularityGte: 1,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeVideo: false,
      },
    },
  },
  "90s-essentials": {
    id: "90s-essentials",
    titleKey: "discover.collections.90sEssentials.title",
    descriptionKey: "discover.collections.90sEssentials.description",
    criteria: {
      movie: {
        releaseDateGte: "1990-01-01",
        releaseDateLte: "1999-12-31",
        voteAverageGte: 7.0,
        voteCountGte: 200,
        popularityGte: 10,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeVideo: false,
      },
      tv: {
        firstAirDateGte: "1990-01-01",
        firstAirDateLte: "1999-12-31",
        voteAverageGte: 7.0,
        voteCountGte: 200,
        popularityGte: 10,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeNullFirstAirDates: false,
      },
    },
  },
  "modern-classics": {
    id: "modern-classics",
    titleKey: "discover.collections.modernClassics.title",
    descriptionKey: "discover.collections.modernClassics.description",
    criteria: {
      movie: {
        releaseDateGte: "2000-01-01",
        releaseDateLte: "2019-12-31",
        voteAverageGte: 7.2,
        voteCountGte: 300,
        popularityGte: 10,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeVideo: false,
      },
      tv: {
        firstAirDateGte: "2000-01-01",
        firstAirDateLte: "2019-12-31",
        voteAverageGte: 7.2,
        voteCountGte: 300,
        popularityGte: 10,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeNullFirstAirDates: false,
      },
    },
  },
  "critically-acclaimed": {
    id: "critically-acclaimed",
    titleKey: "discover.collections.criticallyAcclaimed.title",
    descriptionKey: "discover.collections.criticallyAcclaimed.description",
    criteria: {
      movie: {
        voteAverageGte: 7.6,
        voteCountGte: 500,
        popularityGte: 5,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeVideo: false,
      },
      tv: {
        voteAverageGte: 7.6,
        voteCountGte: 500,
        popularityGte: 5,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeNullFirstAirDates: false,
      },
    },
  },
  "something-weird": {
    id: "something-weird",
    titleKey: "discover.collections.somethingWeird.title",
    descriptionKey: "discover.collections.somethingWeird.description",
    criteria: {
      movie: {
        genres: [14, 27, 878, 9648],
        voteAverageGte: 6.0,
        voteCountGte: 75,
        popularityLte: 35,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeVideo: false,
      },
      tv: {
        genres: [14, 27, 878, 9648],
        voteAverageGte: 6.0,
        voteCountGte: 75,
        popularityLte: 35,
        sortBy: "popularity.desc",
        includeAdult: false,
        includeNullFirstAirDates: false,
      },
    },
  },
  "new-this-month": {
    id: "new-this-month",
    titleKey: "discover.collections.newThisMonth.title",
    descriptionKey: "discover.collections.newThisMonth.description",
    criteria: {
      movie: buildCurrentMonthCriteria("release_date"),
      tv: buildCurrentMonthCriteria("first_air_date"),
    },
  },
};

const COLLECTION_IDS = new Set<DiscoverCollectionId>(Object.keys(COLLECTIONS) as DiscoverCollectionId[]);

function buildCurrentMonthCriteria(dateField: "release_date" | "first_air_date") {
  const now = new Date();

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return {
    ...(dateField === "release_date"
      ? {
          releaseDateGte: start.toISOString().slice(0, 10),
          releaseDateLte: end.toISOString().slice(0, 10),
          includeVideo: false,
        }
      : {
          firstAirDateGte: start.toISOString().slice(0, 10),
          firstAirDateLte: end.toISOString().slice(0, 10),
          includeNullFirstAirDates: false,
        }),
    voteAverageGte: 6.0,
    voteCountGte: 25,
    popularityGte: 1,
    sortBy: "popularity.desc",
    includeAdult: false,
  };
}

function cloneParams(params: Record<string, string>) {
  return { ...params };
}

function setIfDefined(
  params: Record<string, string>,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value === null || value === undefined) {
    return;
  }

  params[key] = typeof value === "boolean" ? String(value) : String(value);
}

function normalizeGenres(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort(
    (a, b) => a - b,
  );
}

function mergeGenreLists(
  collectionGenres: number[] | undefined,
  userGenres: number[],
) {
  return normalizeGenres([...(collectionGenres ?? []), ...userGenres]);
}

function maxDefined(...values: Array<number | undefined>) {
  const defined = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (defined.length === 0) {
    return undefined;
  }

  return Math.max(...defined);
}

function buildParamsForCriteria(
  criteria: DiscoverCollectionCriteria,
  page?: number,
) {
  const params: Record<string, string> = {};

  setIfDefined(params, "sort_by", criteria.sortBy ?? "popularity.desc");
  setIfDefined(params, "page", page);
  setIfDefined(params, "include_adult", criteria.includeAdult ?? false);
  setIfDefined(params, "include_video", criteria.includeVideo);
  setIfDefined(params, "include_null_first_air_dates", criteria.includeNullFirstAirDates);
  setIfDefined(params, "with_runtime.lte", criteria.runtimeLte);
  setIfDefined(params, "vote_average.gte", criteria.voteAverageGte);
  setIfDefined(params, "vote_count.gte", criteria.voteCountGte);
  setIfDefined(params, "popularity.gte", criteria.popularityGte);
  setIfDefined(params, "popularity.lte", criteria.popularityLte);
  setIfDefined(params, "with_genres", criteria.genres?.join(","));
  setIfDefined(params, "release_date.gte", criteria.releaseDateGte);
  setIfDefined(params, "release_date.lte", criteria.releaseDateLte);
  setIfDefined(params, "first_air_date.gte", criteria.firstAirDateGte);
  setIfDefined(params, "first_air_date.lte", criteria.firstAirDateLte);

  return params;
}

function tightenCollectionParams(
  base: Record<string, string>,
  mediaType: MediaType,
  filters: DiscoverCollectionFilters,
  page: number,
) {
  const params = cloneParams(base);

  params.page = String(page);
  params.include_adult = "false";

  if (mediaType === "movie" && params.include_video === undefined) {
    params.include_video = "false";
  }

  const existingGenres = params.with_genres ? params.with_genres.split(",").map((value) => Number(value)) : [];
  const genres = mergeGenreLists(existingGenres, filters.genreIds);

  if (genres.length > 0) {
    params.with_genres = genres.join(",");
  } else {
    delete params.with_genres;
  }

  const existingMinRating = params["vote_average.gte"]
    ? Number(params["vote_average.gte"])
    : undefined;
  const minRating = maxDefined(existingMinRating, filters.minRating > 0 ? filters.minRating : undefined);

  if (minRating !== undefined) {
    params["vote_average.gte"] = String(minRating);
  }

  return params;
}

function buildRequestQueryKey(
  requests: Array<{ type: MediaType; params: Record<string, string> }>,
) {
  return requests.map(({ type, params }) => [
    type,
    Object.keys(params)
      .sort()
      .map((key) => [key, params[key]]),
  ]);
}

export function parseDiscoverCollection(
  value: string | null,
): DiscoverCollection | null {
  if (!value) {
    return null;
  }

  if (!COLLECTION_IDS.has(value as DiscoverCollectionId)) {
    return null;
  }

  return COLLECTIONS[value as DiscoverCollectionId];
}

export function buildDiscoverCollectionParams(
  collection: DiscoverCollection,
  mediaType: MediaType,
): Record<string, string> | null {
  const criteria = collection.criteria[mediaType];

  if (!criteria) {
    return null;
  }

  return buildParamsForCriteria(criteria);
}

export function mergeDiscoverCriteria(input: {
  collection: DiscoverCollection | null;
  filters: DiscoverCollectionFilters;
  page: number;
}): {
  requests: Array<{ type: MediaType; params: Record<string, string> }>;
  queryKey: readonly unknown[];
} {
  const collectionId = input.collection?.id ?? null;
  const normalizedGenres = normalizeGenres(input.filters.genreIds);
  const normalizedPage = Number.isFinite(input.page) && input.page > 0 ? Math.floor(input.page) : 1;
  const requests: Array<{ type: MediaType; params: Record<string, string> }> = [];
  const types: MediaType[] =
    input.filters.mediaType === "all"
      ? ["movie", "tv"]
      : [input.filters.mediaType];

  for (const type of types) {
    const collectionParams = input.collection
      ? buildDiscoverCollectionParams(input.collection, type)
      : buildParamsForCriteria({});

    if (!collectionParams) {
      continue;
    }

    const params = tightenCollectionParams(
      collectionParams,
      type,
      {
        ...input.filters,
        genreIds: normalizedGenres,
      },
      normalizedPage,
    );

    requests.push({
      type,
      params,
    });
  }

  return {
    requests,
    queryKey: [
      "discover-collections",
      collectionId,
      buildRequestQueryKey(requests),
    ],
  };
}
