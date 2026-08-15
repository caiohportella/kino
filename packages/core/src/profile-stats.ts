import type {
  MediaType,
  ProfileGenreStat,
  ProfileLifetimeRecap,
  ProfileLifetimeStats,
  ProfileMediaSplit,
  ProfileMediaStats,
  ProfileMonthlyRecap,
  ProfileMonthlyRecapActivityDay,
  ProfileMonthlyRecapPersonStat,
  ProfileMonthlyRecapSeries,
  ProfileMonthlyRecapTitle,
  ProfileRatedCategoryStat,
  ProfileRatedDecadeStat,
  ProfileRatedTitleStat,
  ProfileRatingBucket,
  ProfileRatingStats,
  ProfileStudioStat,
  ProfileViewingBreakdownStats,
  TMDbCast,
  TMDbGenre,
  TMDbProductionCompany,
  WatchedSeries,
  WatchType,
} from "./types.ts";

type JoinedTitleRow = {
  id: string;
  title: string;
  type: MediaType;
  genres?: TMDbGenre[] | null;
  cast?: TMDbCast[] | null;
  production_companies?: TMDbProductionCompany[] | null;
  cover_image?: string | null;
  tmdb_data?: {
    production_companies?: TMDbProductionCompany[] | null;
  } | null;
  tmdb_id: number;
  runtime?: number | null;
  release_year?: number | null;
  episode_runtime?: number | null;
};

type JoinedTitle = JoinedTitleRow | JoinedTitleRow[] | null | undefined;

type WatchEventRow = {
  title_id: string;
  watched_at?: string;
  watch_type?: WatchType;
  runtime_minutes?: number | null;
  title?: JoinedTitle;
  titles?: JoinedTitle;
};

type RatingEventRow = {
  title_id: string;
  rating: string | number | null;
  watched_at: string;
  watch_type?: WatchType;
  runtime_minutes?: number | null;
  season_number?: number;
  episode_number?: number;
  title?: JoinedTitle;
  titles?: JoinedTitle;
};

type ProfileActivityTitle = ProfileMonthlyRecapTitle & {
  latestWatchedAt: number;
};

type CanonicalRatingRow = {
  title_id?: string;
  rating: string | number | null;
  watched_at?: string;
  season_number?: number;
  episode_number?: number;
  title?: JoinedTitle;
  titles?: JoinedTitle;
};

type CanonicalRatedTitle = {
  titleId: string;
  rating: number;
  title: JoinedTitleRow;
  observationCount: number;
};

type RatingCandidate = {
  rating: number;
  watchedAt: number;
  title: JoinedTitleRow;
  observationCount: number;
};

type MonthRange = {
  end: Date;
  start: Date;
};

function buildCanonicalRatedTitles(
  rows: CanonicalRatingRow[],
): Map<string, CanonicalRatedTitle> {
  const movies = new Map<string, RatingCandidate>();
  const explicitSeries = new Map<string, RatingCandidate>();
  const episodeRatings = new Map<string, Map<string, RatingCandidate>>();

  for (const row of rows) {
    const rating = normalizeRating(row.rating);
    const title = unwrapTitle(row.title ?? row.titles);
    const titleId = row.title_id ?? title?.id;

    if (rating == null || !title || !titleId) continue;

    const watchedAt = row.watched_at
      ? Date.parse(row.watched_at)
      : Number.NEGATIVE_INFINITY;
    const candidate = {
      rating,
      watchedAt: Number.isFinite(watchedAt)
        ? watchedAt
        : Number.NEGATIVE_INFINITY,
      title,
      observationCount: 1,
    };

    if (title.type === "movie") {
      const existing = movies.get(titleId);
      movies.set(titleId, selectLatestRating(existing, candidate));
      continue;
    }

    const hasEpisodeKey =
      Number.isInteger(row.season_number) &&
      Number.isInteger(row.episode_number);

    if (!hasEpisodeKey) {
      const existing = explicitSeries.get(titleId);
      explicitSeries.set(titleId, selectLatestRating(existing, candidate));
      continue;
    }

    const byEpisode = episodeRatings.get(titleId) ?? new Map();
    const episodeKey = `${row.season_number}:${row.episode_number}`;
    const existing = byEpisode.get(episodeKey);
    byEpisode.set(episodeKey, selectLatestRating(existing, candidate));
    episodeRatings.set(titleId, byEpisode);
  }

  const canonicalTitles = new Map<string, CanonicalRatedTitle>();

  for (const [titleId, candidate] of movies) {
    canonicalTitles.set(titleId, {
      titleId,
      rating: candidate.rating,
      title: candidate.title,
      observationCount: candidate.observationCount,
    });
  }

  for (const [titleId, candidate] of explicitSeries) {
    canonicalTitles.set(titleId, {
      titleId,
      rating: candidate.rating,
      title: candidate.title,
      observationCount: candidate.observationCount,
    });
  }

  for (const [titleId, byEpisode] of episodeRatings) {
    if (explicitSeries.has(titleId) || byEpisode.size === 0) continue;

    const candidates = Array.from(byEpisode.values());
    const firstCandidate = candidates[0];
    if (!firstCandidate) continue;
    const total = candidates.reduce(
      (sum, candidate) => sum + candidate.rating,
      0,
    );
    const observationCount = candidates.reduce(
      (sum, candidate) => sum + candidate.observationCount,
      0,
    );

    canonicalTitles.set(titleId, {
      titleId,
      rating: total / candidates.length,
      title: firstCandidate.title,
      observationCount,
    });
  }

  return canonicalTitles;
}

function selectLatestRating(
  existing: RatingCandidate | undefined,
  candidate: RatingCandidate,
) {
  if (!existing) return candidate;

  if (
    candidate.watchedAt > existing.watchedAt ||
    (candidate.watchedAt === existing.watchedAt &&
      candidate.rating > existing.rating)
  ) {
    return {
      ...candidate,
      observationCount: existing.observationCount + 1,
    };
  }

  return {
    ...existing,
    observationCount: existing.observationCount + 1,
  };
}

type HighlightCandidate = {
  id: number;
  name: string;
  total: number;
  weight: number;
  titleIds: Set<string>;
  observationCount: number;
};

type DecadeCandidate = {
  startYear: number;
  total: number;
  titleIds: Set<string>;
  observationCount: number;
};

type RatedHighlights = {
  highestRatedStudio: ProfileRatedCategoryStat | null;
  highestRatedActor: ProfileRatedCategoryStat | null;
  highestRatedActress: ProfileRatedCategoryStat | null;
  highestRatedGenre: ProfileRatedCategoryStat | null;
  highestRatedDecade: ProfileRatedDecadeStat | null;
  mostRatedGenre: ProfileRatedCategoryStat | null;
};

const BAYESIAN_CONFIDENCE_THRESHOLD = 3;

function getCastProminenceWeight(order: number | undefined) {
  if (order == null || !Number.isFinite(order)) return 0;
  if (order <= 1) return 1;
  if (order <= 4) return 0.85;
  if (order <= 9) return 0.65;
  if (order <= 14) return 0.4;
  return 0;
}

function getBayesianRankingScore(
  rawAverage: number,
  distinctTitleCount: number,
  scopeAverage: number,
) {
  const evidence = distinctTitleCount;
  const priorWeight = BAYESIAN_CONFIDENCE_THRESHOLD;
  return (
    (evidence / (evidence + priorWeight)) * rawAverage +
    (priorWeight / (evidence + priorWeight)) * scopeAverage
  );
}

function calculateRatedHighlights(
  rows: CanonicalRatingRow[],
  eligibilityThreshold: number,
): RatedHighlights {
  const canonicalTitles = buildCanonicalRatedTitles(rows);
  const genreCandidates = new Map<number, HighlightCandidate>();
  const studioCandidates = new Map<number, HighlightCandidate>();
  const actorCandidates = new Map<number, HighlightCandidate>();
  const actressCandidates = new Map<number, HighlightCandidate>();
  const decadeCandidates = new Map<number, DecadeCandidate>();

  let scopeTotal = 0;

  for (const canonicalTitle of canonicalTitles.values()) {
    const { rating, title, titleId, observationCount } = canonicalTitle;
    scopeTotal += rating;

    for (const genre of title.genres ?? []) {
      if (!genre?.id || !genre.name) continue;
      addWeightedCandidate(
        genreCandidates,
        genre.id,
        genre.name,
        rating,
        1,
        titleId,
        observationCount,
      );
    }

    for (const studio of productionCompaniesForTitle(title)) {
      if (!studio?.id || !studio.name) continue;
      addWeightedCandidate(
        studioCandidates,
        studio.id,
        studio.name,
        rating,
        1,
        titleId,
        observationCount,
      );
    }

    for (const person of title.cast ?? []) {
      if (!person?.id || !person.name) continue;
      const weight = getCastProminenceWeight(person.order);
      if (weight <= 0) continue;

      const target =
        person.gender === 2
          ? actorCandidates
          : person.gender === 1
            ? actressCandidates
            : null;

      if (!target) continue;
      addWeightedCandidate(
        target,
        person.id,
        person.name,
        rating,
        weight,
        titleId,
        observationCount,
      );
    }

    const releaseYear = title.release_year;
    if (
      typeof releaseYear === "number" &&
      Number.isInteger(releaseYear) &&
      releaseYear > 0
    ) {
      const startYear = Math.floor(releaseYear / 10) * 10;
      const current = decadeCandidates.get(startYear) ?? {
        startYear,
        total: 0,
        titleIds: new Set<string>(),
        observationCount: 0,
      };
      current.total += rating;
      current.titleIds.add(titleId);
      current.observationCount += observationCount;
      decadeCandidates.set(startYear, current);
    }
  }

  const scopeAverage =
    canonicalTitles.size > 0 ? scopeTotal / canonicalTitles.size : 0;

  return {
    highestRatedStudio: rankWeightedCandidates(
      studioCandidates,
      eligibilityThreshold,
      scopeAverage,
    ),
    highestRatedActor: rankWeightedCandidates(
      actorCandidates,
      eligibilityThreshold,
      scopeAverage,
    ),
    highestRatedActress: rankWeightedCandidates(
      actressCandidates,
      eligibilityThreshold,
      scopeAverage,
    ),
    highestRatedGenre: rankWeightedCandidates(
      genreCandidates,
      eligibilityThreshold,
      scopeAverage,
      true,
    ),
    highestRatedDecade: rankDecades(
      decadeCandidates,
      eligibilityThreshold,
      scopeAverage,
    ),
    mostRatedGenre: rankMostRatedGenre(genreCandidates),
  };
}

function addWeightedCandidate(
  candidates: Map<number, HighlightCandidate>,
  id: number,
  name: string,
  rating: number,
  weight: number,
  titleId: string,
  observationCount: number,
) {
  const current = candidates.get(id) ?? {
    id,
    name,
    total: 0,
    weight: 0,
    titleIds: new Set<string>(),
    observationCount: 0,
  };

  current.total += rating * weight;
  current.weight += weight;
  current.titleIds.add(titleId);
  current.observationCount += observationCount;
  current.name = name;
  candidates.set(id, current);
}

function rankWeightedCandidates(
  candidates: Map<number, HighlightCandidate>,
  eligibilityThreshold: number,
  scopeAverage: number,
  includeId = false,
): ProfileRatedCategoryStat | null {
  const ranked = Array.from(candidates.values())
    .map((candidate) => {
      const titleCount = candidate.titleIds.size;
      const average =
        candidate.weight > 0 ? candidate.total / candidate.weight : 0;
      return {
        candidate,
        average,
        rankingScore: getBayesianRankingScore(
          average,
          titleCount,
          scopeAverage,
        ),
      };
    })
    .filter(({ candidate }) => candidate.titleIds.size >= eligibilityThreshold)
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore ||
        right.candidate.titleIds.size - left.candidate.titleIds.size ||
        right.average - left.average ||
        right.candidate.observationCount - left.candidate.observationCount ||
        left.candidate.id - right.candidate.id ||
        left.candidate.name.localeCompare(right.candidate.name),
    );

  const top = ranked[0];
  if (!top) return null;

  const result: ProfileRatedCategoryStat = {
    name: top.candidate.name,
    average: top.average,
    count: top.candidate.observationCount,
    titleCount: top.candidate.titleIds.size,
  };

  if (includeId) result.id = top.candidate.id;
  return result;
}

function rankMostRatedGenre(
  candidates: Map<number, HighlightCandidate>,
): ProfileRatedCategoryStat | null {
  const top = Array.from(candidates.values()).sort(
    (left, right) =>
      right.titleIds.size - left.titleIds.size ||
      right.total / right.weight - left.total / left.weight ||
      left.id - right.id ||
      left.name.localeCompare(right.name),
  )[0];

  if (!top) return null;

  return {
    id: top.id,
    name: top.name,
    average: top.total / top.weight,
    count: top.observationCount,
    titleCount: top.titleIds.size,
  };
}

function rankDecades(
  candidates: Map<number, DecadeCandidate>,
  eligibilityThreshold: number,
  scopeAverage: number,
): ProfileRatedDecadeStat | null {
  const ranked = Array.from(candidates.values())
    .map((candidate) => {
      const titleCount = candidate.titleIds.size;
      const average = titleCount > 0 ? candidate.total / titleCount : 0;
      return {
        candidate,
        average,
        rankingScore: getBayesianRankingScore(
          average,
          titleCount,
          scopeAverage,
        ),
      };
    })
    .filter(({ candidate }) => candidate.titleIds.size >= eligibilityThreshold)
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore ||
        right.candidate.titleIds.size - left.candidate.titleIds.size ||
        right.average - left.average ||
        right.candidate.observationCount - left.candidate.observationCount ||
        left.candidate.startYear - right.candidate.startYear,
    )[0];

  if (!ranked) return null;

  return {
    startYear: ranked.candidate.startYear,
    average: ranked.average,
    count: ranked.candidate.observationCount,
    titleCount: ranked.candidate.titleIds.size,
  };
}

export function createMonthRange(year: number, month: number): MonthRange {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export function calculateProfileRatingStats(
  rows: CanonicalRatingRow[],
): ProfileRatingStats {
  const buckets = new Map<number, number>();

  const latestMovieRatings = new Map<string, ProfileRatedTitleStat>();
  const latestMovieRatingTimes = new Map<string, number>();

  const seriesRatings = new Map<
    string,
    {
      titleId: string;
      title: string;
      total: number;
      count: number;
    }
  >();

  let totalRatings = 0;
  let sum = 0;
  let movieRatingTotal = 0;
  let movieRatingCount = 0;
  let seriesRatingTotal = 0;
  let seriesRatingCount = 0;

  for (const row of rows) {
    const rating = normalizeRating(row.rating);
    if (rating == null) continue;

    totalRatings += 1;
    sum += rating;

    buckets.set(rating, (buckets.get(rating) ?? 0) + 1);

    const title = unwrapTitle(row.title ?? row.titles);

    if (title?.type === "movie") {
      movieRatingTotal += rating;
      movieRatingCount += 1;
    } else if (title?.type === "tv") {
      seriesRatingTotal += rating;
      seriesRatingCount += 1;
    }

    const titleId = row.title_id ?? title?.id;

    if (titleId && title?.title && title.type === "movie") {
      const watchedAtMs = row.watched_at
        ? Date.parse(row.watched_at)
        : Number.NEGATIVE_INFINITY;

      const previousTime =
        latestMovieRatingTimes.get(titleId) ?? Number.NEGATIVE_INFINITY;

      if (!latestMovieRatings.has(titleId) || watchedAtMs >= previousTime) {
        latestMovieRatings.set(titleId, {
          titleId,
          title: title.title,
          rating,
          ratingCount: 1,
        });

        latestMovieRatingTimes.set(titleId, watchedAtMs);
      }
    }

    if (titleId && title?.title && title.type === "tv") {
      const current = seriesRatings.get(titleId) ?? {
        titleId,
        title: title.title,
        total: 0,
        count: 0,
      };

      current.total += rating;
      current.count += 1;
      current.title = title.title;

      seriesRatings.set(titleId, current);
    }
  }

  const ratedHighlights = calculateRatedHighlights(rows, 3);

  const distribution: ProfileRatingBucket[] = ratingSteps().map((rating) => ({
    rating,
    count: buckets.get(rating) ?? 0,
    percentage:
      totalRatings > 0 ? ((buckets.get(rating) ?? 0) / totalRatings) * 100 : 0,
  }));

  const movieRatingStats = Array.from(latestMovieRatings.values());

  const highestRatedMovie = movieRatingStats
    .slice()
    .sort(
      (left, right) =>
        right.rating - left.rating ||
        (latestMovieRatingTimes.get(right.titleId) ??
          Number.NEGATIVE_INFINITY) -
          (latestMovieRatingTimes.get(left.titleId) ??
            Number.NEGATIVE_INFINITY) ||
        left.title.localeCompare(right.title),
    )[0];

  const lowestRatedMovie = movieRatingStats
    .slice()
    .sort(
      (left, right) =>
        left.rating - right.rating ||
        (latestMovieRatingTimes.get(right.titleId) ??
          Number.NEGATIVE_INFINITY) -
          (latestMovieRatingTimes.get(left.titleId) ??
            Number.NEGATIVE_INFINITY) ||
        left.title.localeCompare(right.title),
    )[0];

  const seriesRatingStats: ProfileRatedTitleStat[] = Array.from(
    seriesRatings.values(),
  ).map((series) => ({
    titleId: series.titleId,
    title: series.title,
    rating: series.total / series.count,
    ratingCount: series.count,
  }));

  const highestRatedSeries = seriesRatingStats
    .slice()
    .sort(
      (left, right) =>
        right.rating - left.rating ||
        right.ratingCount - left.ratingCount ||
        left.title.localeCompare(right.title),
    )[0];

  const lowestRatedSeries = seriesRatingStats
    .slice()
    .sort(
      (left, right) =>
        left.rating - right.rating ||
        right.ratingCount - left.ratingCount ||
        left.title.localeCompare(right.title),
    )[0];

  return {
    averageRating: totalRatings > 0 ? roundRating(sum / totalRatings) : null,
    movieAverageRating:
      movieRatingCount > 0
        ? roundRating(movieRatingTotal / movieRatingCount)
        : null,
    seriesAverageRating:
      seriesRatingCount > 0
        ? roundRating(seriesRatingTotal / seriesRatingCount)
        : null,
    totalRatings,
    distribution,
    fiveStarRate:
      totalRatings > 0 ? ((buckets.get(5) ?? 0) / totalRatings) * 100 : 0,
    mostRatedGenre: ratedHighlights.mostRatedGenre,
    highestRatedGenre: ratedHighlights.highestRatedGenre,
    highestRatedDecade: ratedHighlights.highestRatedDecade,
    highestRatedStudio: ratedHighlights.highestRatedStudio,
    highestRatedActor: ratedHighlights.highestRatedActor,
    highestRatedActress: ratedHighlights.highestRatedActress,

    highestRatedMovie: highestRatedMovie ?? null,
    lowestRatedMovie: lowestRatedMovie ?? null,
    highestRatedSeries: highestRatedSeries ?? null,
    lowestRatedSeries: lowestRatedSeries ?? null,
  };
}

export function calculateProfileMediaStats(input: {
  seriesWatched: number;
  watchedMovies: Array<{ rating: number | string | null }>;
  watchedSeries: Array<{ id: string }>;
  seriesRatings: Record<string, number>;
}): ProfileMediaStats {
  const ratedMovies = input.watchedMovies
    .map((movie) => normalizeRating(movie.rating))
    .filter((rating): rating is number => rating != null && rating > 0);

  const watchedSeriesIds = new Set(
    input.watchedSeries.map((series) => series.id).filter((id) => Boolean(id)),
  );
  const ratedSeries = Object.entries(input.seriesRatings)
    .map(([titleId, rating]) => ({ titleId, rating: normalizeRating(rating) }))
    .filter(
      (entry) =>
        watchedSeriesIds.has(entry.titleId) &&
        entry.rating != null &&
        entry.rating > 0,
    );

  return {
    seriesWatched: input.seriesWatched,
    movieRatings: {
      average:
        ratedMovies.length > 0
          ? ratedMovies.reduce((sum, rating) => sum + rating, 0) /
            ratedMovies.length
          : null,
      ratedCount: ratedMovies.length,
    },
    seriesRatings: {
      average:
        ratedSeries.length > 0
          ? ratedSeries.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) /
            ratedSeries.length
          : null,
      ratedCount: ratedSeries.length,
    },
  };
}

export function calculateProfileViewingBreakdownStats(input: {
  diaryRows: WatchEventRow[];
  episodeRows: WatchEventRow[];
}): ProfileViewingBreakdownStats {
  const movieDays = new Set<string>();
  const tvDays = new Set<string>();

  let movieRuntimeTotal = 0;
  let movieRuntimeCount = 0;

  for (const row of input.diaryRows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (!title || title.type !== "movie") continue;

    const runtime = title.runtime;
    if (runtime == null) continue;

    movieRuntimeTotal += runtime;
    movieRuntimeCount += 1;
  }

  let watchedEpisodeCount = 0;
  let longestBingeEpisodes = 0;

  const watchedSeriesIds = new Set<string>();
  const bingeCounts = new Map<string, number>();

  for (const row of input.episodeRows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (!title || title.type !== "tv") continue;

    watchedEpisodeCount += 1;
    watchedSeriesIds.add(row.title_id);

    if (!row.watched_at) continue;

    const day = new Date(row.watched_at).toISOString().slice(0, 10);
    const bingeKey = `${row.title_id}:${day}`;
    const bingeCount = (bingeCounts.get(bingeKey) ?? 0) + 1;

    bingeCounts.set(bingeKey, bingeCount);
    longestBingeEpisodes = Math.max(longestBingeEpisodes, bingeCount);
  }

  const movieTimeWatchedMinutes = sumWatchTime(
    input.diaryRows,
    "movie",
    (title) => title.runtime ?? null,
    movieDays,
  );

  const tvTimeWatchedMinutes = sumWatchTime(
    input.episodeRows,
    "tv",
    (title, row) => row.runtime_minutes ?? title.episode_runtime ?? null,
    tvDays,
  );

  const weekdayMedia = { movies: 0, series: 0 };
  const weekendMedia = { movies: 0, series: 0 };

  for (const row of input.diaryRows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (title?.type !== "movie" || !row.watched_at) continue;

    const day = utcDayOfWeek(row.watched_at);
    if (day == null) continue;

    (day === 0 || day === 6 ? weekendMedia : weekdayMedia).movies += 1;
  }

  for (const row of input.episodeRows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (title?.type !== "tv" || !row.watched_at) continue;

    const day = utcDayOfWeek(row.watched_at);
    if (day == null) continue;

    (day === 0 || day === 6 ? weekendMedia : weekdayMedia).series += 1;
  }

  return {
    movieTimeWatchedMinutes,
    tvTimeWatchedMinutes,

    averageMovieRuntimeMinutes:
      movieRuntimeCount > 0 ? movieRuntimeTotal / movieRuntimeCount : 0,

    averageEpisodesPerSeries:
      watchedSeriesIds.size > 0
        ? watchedEpisodeCount / watchedSeriesIds.size
        : 0,

    longestBingeEpisodes,

    longestMovieStreakDays: calculateLongestStreak(movieDays),
    longestSeriesStreakDays: calculateLongestStreak(tvDays),
    studioStats: calculateStudioStats(input.diaryRows),
    weekdayMediaSplit: buildMediaSplit(weekdayMedia),
    weekendMediaSplit: buildMediaSplit(weekendMedia),
  };
}

export function calculateProfileGenreStats(
  rows: Array<{ title?: JoinedTitle; titles?: JoinedTitle }>,
  limit = 5,
): ProfileGenreStat[] {
  const genres = new Map<number, { count: number; name: string }>();
  let total = 0;

  for (const row of rows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (!title?.genres?.length) continue;

    const weight = 1 / title.genres.length;

    for (const genre of title.genres) {
      if (!genre?.id || !genre.name) continue;

      const entry = genres.get(genre.id) ?? {
        count: 0,
        name: genre.name,
      };

      entry.count += weight;
      entry.name = genre.name;

      genres.set(genre.id, entry);
      total += weight;
    }
  }

  return Array.from(genres.entries())
    .map(([genreId, value]) => ({
      genreId,
      name: value.name,
      count: value.count,
      percentage: total > 0 ? (value.count / total) * 100 : 0,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    )
    .slice(0, limit);
}

export function calculateProfileLifetimeStats(input: {
  diaryRows: WatchEventRow[];
  episodeRows: WatchEventRow[];
  movieRatingsCount: number;
  episodeRatingsCount: number;
}): ProfileLifetimeStats {
  let moviesWatched = 0;
  let episodesWatched = 0;
  let timeWatchedMinutes = 0;

  for (const row of input.diaryRows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (!title || title.type !== "movie") continue;
    moviesWatched += 1;
    timeWatchedMinutes += title.runtime ?? 0;
  }

  for (const row of input.episodeRows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (!title || title.type !== "tv") continue;
    episodesWatched += 1;
    timeWatchedMinutes += row.runtime_minutes ?? title.episode_runtime ?? 0;
  }

  return {
    moviesWatched,
    episodesWatched,
    ratingsMade: input.movieRatingsCount + input.episodeRatingsCount,
    timeWatchedMinutes,
  };
}

export function buildProfileMonthlyRecap(input: {
  year: number;
  month: number;
  current: {
    diaryRows: WatchEventRow[];
    movieRatingRows: RatingEventRow[];
    episodeRatingRows: RatingEventRow[];
    watchedSeries?: WatchedSeries[];
  };
  previous: {
    diaryRows: WatchEventRow[];
    movieRatingRows: RatingEventRow[];
    episodeRatingRows: RatingEventRow[];
  };
}): ProfileMonthlyRecap {
  const currentRange = createMonthRange(input.year, input.month);

  const currentSummary = summarizeProfileActivity({
    diaryRows: input.current.diaryRows,
    movieRatingRows: input.current.movieRatingRows,
    episodeRatingRows: input.current.episodeRatingRows,
    watchedSeries: input.current.watchedSeries ?? [],
    monthRange: currentRange,
  });

  const previousSummary = summarizeProfileActivity({
    diaryRows: input.previous.diaryRows,
    movieRatingRows: input.previous.movieRatingRows,
    episodeRatingRows: input.previous.episodeRatingRows,
    watchedSeries: [],
    monthRange: createMonthRange(
      input.month === 1 ? input.year - 1 : input.year,
      input.month === 1 ? 12 : input.month - 1,
    ),
  });

  const titles = Array.from(currentSummary.titleById.values());

  const highestRated =
    titles
      .filter((title) => title.rating != null && title.rating > 0)
      .sort(
        (left, right) =>
          (right.rating ?? 0) - (left.rating ?? 0) ||
          right.count - left.count ||
          right.latestWatchedAt - left.latestWatchedAt ||
          left.title.localeCompare(right.title),
      )
      .map(stripTitleInternal)[0] ?? null;

  const lowestRated =
    titles
      .filter((title) => title.rating != null && title.rating > 0)
      .sort(
        (left, right) =>
          (left.rating ?? 0) - (right.rating ?? 0) ||
          right.count - left.count ||
          right.latestWatchedAt - left.latestWatchedAt ||
          left.title.localeCompare(right.title),
      )
      .map(stripTitleInternal)[0] ?? null;

  const topRatedMovies = titles
    .filter(
      (title) =>
        title.mediaType === "movie" && title.rating != null && title.rating > 0,
    )
    .sort(compareTopRatedMovieTitles)
    .map(stripTitleInternal)
    .slice(0, 10);

  const topRatedSeries = titles
    .filter(
      (title) =>
        title.mediaType === "tv" && title.rating != null && title.rating > 0,
    )
    .sort(compareTopRatedSeriesTitles)
    .map(stripTitleInternal)
    .slice(0, 10);

  /**
   * "Top titles" now means actual consumption.
   *
   * Ratings already have dedicated highest/lowest and top-rated fields.
   * Ranking this by rating duplicated information on the recap page.
   */
  const topTitles = titles
    .sort(
      (left, right) =>
        (right.watchTimeMinutes ?? 0) - (left.watchTimeMinutes ?? 0) ||
        right.count - left.count ||
        right.latestWatchedAt - left.latestWatchedAt ||
        left.title.localeCompare(right.title),
    )
    .map(stripTitleInternal)
    .slice(0, 10);

  const mostWatchedSeries = Array.from(currentSummary.seriesByTitle.values())
    .sort(
      (left, right) =>
        (right.watchTimeMinutes ?? 0) - (left.watchTimeMinutes ?? 0) ||
        right.count - left.count ||
        left.firstWatchedAt - right.firstWatchedAt ||
        left.title.localeCompare(right.title),
    )
    .map(({ firstWatchedAt: _firstWatchedAt, ...series }) => series)
    .slice(0, 5);

  return {
    year: input.year,
    month: input.month,

    moviesWatched: currentSummary.movieWatchCount,
    episodesWatched: currentSummary.episodesWatched,
    timeWatchedMinutes: currentSummary.timeWatchedMinutes,

    ratingsMade: currentSummary.ratingsCount,
    rewatches: currentSummary.rewatches,
    activeDays: currentSummary.activeDays.size,

    uniqueTitlesWatched: currentSummary.titleById.size,
    averageRating: currentSummary.averageRating,

    dailyActivity: Array.from(currentSummary.dailyActivity.entries())
      .map<ProfileMonthlyRecapActivityDay>(([date, value]) => ({
        date,
        entries: value.entries,
        moviesWatched: value.moviesWatched,
        episodesWatched: value.episodesWatched,
        minutes: value.minutes,
      }))
      .sort((left, right) => left.date.localeCompare(right.date)),

    highestRated,
    lowestRated,
    topRatedMovies,
    topRatedSeries,
    topTitles,

    topGenres: currentSummary.genreStats,

    mostWatchedSeries,
    finishedSeries: currentSummary.finishedSeries,

    mostWatchedStudio: currentSummary.studioStats[0] ?? null,

    topActor: currentSummary.topActor,

    highestRatedStudio: currentSummary.ratedHighlights.highestRatedStudio,

    highestRatedActor: currentSummary.ratedHighlights.highestRatedActor,

    highestRatedActress: currentSummary.ratedHighlights.highestRatedActress,

    highestRatedGenre: currentSummary.ratedHighlights.highestRatedGenre,

    highestRatedDecade: currentSummary.ratedHighlights.highestRatedDecade,

    previousMonthComparison: {
      moviesDelta:
        currentSummary.movieWatchCount - previousSummary.movieWatchCount,

      episodesDelta:
        currentSummary.episodesWatched - previousSummary.episodesWatched,

      timeWatchedMinutesDelta:
        currentSummary.timeWatchedMinutes - previousSummary.timeWatchedMinutes,

      ratingsDelta: currentSummary.ratingsCount - previousSummary.ratingsCount,
    },
  };
}

export function buildProfileLifetimeRecap(input: {
  lifetime: ProfileLifetimeStats;
  diaryRows: WatchEventRow[];
  movieRatingRows: RatingEventRow[];
  episodeRatingRows: RatingEventRow[];
  watchedSeries?: WatchedSeries[];
}): ProfileLifetimeRecap {
  const watchedSeries = input.watchedSeries ?? [];
  const summary = summarizeProfileActivity({
    diaryRows: input.diaryRows,
    movieRatingRows: input.movieRatingRows,
    episodeRatingRows: input.episodeRatingRows,
    watchedSeries,
  });
  const titles = Array.from(summary.titleById.values());
  const watchedSeriesById = new Map(
    watchedSeries.map((series) => [series.id, series]),
  );

  const topRatedMovies = titles
    .filter(
      (title) =>
        title.mediaType === "movie" && title.rating != null && title.rating > 0,
    )
    .sort(compareTopRatedMovieTitles)
    .map(stripTitleInternal)
    .slice(0, 10);

  const topRatedSeries = titles
    .filter(
      (title) =>
        title.mediaType === "tv" && title.rating != null && title.rating > 0,
    )
    .sort(compareTopRatedSeriesTitles)
    .map(stripTitleInternal)
    .slice(0, 10)
    .map((title) =>
      enrichLifetimeSeriesTitle(title, watchedSeriesById.get(title.titleId)),
    );

  return {
    moviesWatched: input.lifetime.moviesWatched,
    episodesWatched: input.lifetime.episodesWatched,
    timeWatchedMinutes: input.lifetime.timeWatchedMinutes,
    ratingsMade: input.lifetime.ratingsMade,
    topRatedMovies,
    topRatedSeries,
    topGenres: summary.genreStats,
    mostRatedGenre: summary.ratedHighlights.mostRatedGenre,
    highestRatedStudio: summary.ratedHighlights.highestRatedStudio,
    highestRatedActor: summary.ratedHighlights.highestRatedActor,
    highestRatedActress: summary.ratedHighlights.highestRatedActress,
    highestRatedGenre: summary.ratedHighlights.highestRatedGenre,
    highestRatedDecade: summary.ratedHighlights.highestRatedDecade,
  };
}

function compareTopRatedMovieTitles(
  left: ProfileActivityTitle,
  right: ProfileActivityTitle,
) {
  return (
    (right.rating ?? 0) - (left.rating ?? 0) ||
    (right.watchTimeMinutes ?? 0) - (left.watchTimeMinutes ?? 0) ||
    right.latestWatchedAt - left.latestWatchedAt ||
    left.title.localeCompare(right.title)
  );
}

function compareTopRatedSeriesTitles(
  left: ProfileActivityTitle,
  right: ProfileActivityTitle,
) {
  return (
    (right.rating ?? 0) - (left.rating ?? 0) ||
    (right.watchTimeMinutes ?? 0) - (left.watchTimeMinutes ?? 0) ||
    right.count - left.count ||
    left.title.localeCompare(right.title)
  );
}

function stripTitleInternal(item: ProfileActivityTitle): ProfileMonthlyRecapTitle {
  const { latestWatchedAt: _latestWatchedAt, ...title } = item;
  return title;
}

function enrichLifetimeSeriesTitle(
  title: ProfileMonthlyRecapTitle,
  watchedSeries?: WatchedSeries,
): ProfileMonthlyRecapTitle {
  if (!watchedSeries) {
    return title;
  }

  return {
    ...title,
    watchedEpisodeCount: watchedSeries.watched_episode_count,
  };
}

function summarizeProfileActivity(input: {
  diaryRows: WatchEventRow[];
  movieRatingRows: RatingEventRow[];
  episodeRatingRows: RatingEventRow[];
  watchedSeries: WatchedSeries[];
  monthRange?: MonthRange;
}) {
  const {
    diaryRows,
    movieRatingRows,
    episodeRatingRows,
    watchedSeries,
    monthRange,
  } = input;
  const titleById = new Map<string, ProfileActivityTitle>();

  const seriesByTitle = new Map<
    string,
    ProfileMonthlyRecapSeries & {
      firstWatchedAt: number;
    }
  >();

  const activeDays = new Set<string>();

  const genres = new Map<
    number,
    {
      count: number;
      name: string;
      watchTimeMinutes: number;
    }
  >();

  const dailyActivity = new Map<
    string,
    {
      entries: number;
      moviesWatched: number;
      episodesWatched: number;
      minutes: number;
    }
  >();

  const studioCounts = new Map<
    number,
    {
      id: number;
      name: string;
      logoPath: string | null;
      count: number;
    }
  >();

  const actorStats = new Map<
    string,
    {
      id: number | string;
      name: string;
      profilePath: string | null;
      count: number;
      titles: Set<string>;
    }
  >();

  const finishedSeries = new Map<string, ProfileMonthlyRecapSeries>();

  let movieWatchCount = 0;
  let episodesWatched = 0;

  let movieRuntimeMinutes = 0;
  let seriesRuntimeMinutes = 0;

  let ratingsCount = 0;
  let rewatches = 0;
  const ratingRowsForSummary = [
    ...movieRatingRows,
    ...episodeRatingRows,
  ].filter((row) => isRatingWithinRange(row, monthRange));

  /*
   * Aggregate rating events per title.
   *
   * This is especially important for series: multiple episode ratings
   * should produce a representative monthly series rating rather than
   * whichever episode happened to be rated last.
   */
  const ratingStatsByTitle = new Map<
    string,
    {
      sum: number;
      count: number;
    }
  >();

  const ratingValues: number[] = [];

  for (const row of ratingRowsForSummary) {
    const rating = normalizeRating(row.rating);

    if (rating == null) {
      continue;
    }

    ratingsCount += 1;
    ratingValues.push(rating);

    const existing = ratingStatsByTitle.get(row.title_id) ?? {
      sum: 0,
      count: 0,
    };

    existing.sum += rating;
    existing.count += 1;

    ratingStatsByTitle.set(row.title_id, existing);
  }

  const averageRatingByTitle = new Map<string, number>();

  for (const [titleId, rating] of ratingStatsByTitle) {
    averageRatingByTitle.set(titleId, rating.sum / rating.count);
  }

  /* ---------------------------------------------------------------------- */
  /* Movies                                                                 */
  /* ---------------------------------------------------------------------- */

  for (const row of diaryRows) {
    const title = unwrapTitle(row.title ?? row.titles);

    if (!title || !row.watched_at) {
      continue;
    }

    const watchedAt = Date.parse(row.watched_at);

    if (Number.isNaN(watchedAt)) {
      continue;
    }

    const watchedDate = new Date(row.watched_at);

    if (!isWithinRange(watchedDate, monthRange)) {
      continue;
    }

    const watchedDay = toLocalDateKey(watchedDate);

    /*
     * This recap treats watch_diary movie rows as movie watches.
     * If TV diary rows exist for another purpose, don't count them
     * as episode consumption here.
     */
    if (title.type === "movie") {
      movieWatchCount += 1;
      activeDays.add(watchedDay);

      if (row.watch_type === "rewatch") {
        rewatches += 1;
      }

      const runtimeMinutes = Math.max(0, title.runtime ?? 0);

      movieRuntimeMinutes += runtimeMinutes;

      const activity = dailyActivity.get(watchedDay) ?? {
        entries: 0,
        moviesWatched: 0,
        episodesWatched: 0,
        minutes: 0,
      };

      activity.entries += 1;
      activity.moviesWatched += 1;
      activity.minutes += runtimeMinutes;

      dailyActivity.set(watchedDay, activity);

      addGenreConsumption(genres, title, runtimeMinutes);

      recordTopActorStats(actorStats, title, title.id);
    }

    const runtimeMinutes =
      title.type === "movie" ? Math.max(0, title.runtime ?? 0) : 0;

    const titleEntry = titleById.get(title.id) ?? {
      count: 0,
      latestWatchedAt: watchedAt,
      mediaType: title.type,
      rating: averageRatingByTitle.get(title.id) ?? null,
      title: title.title,
      titleId: title.id,
      tmdbId: title.tmdb_id,
      coverImage: title.cover_image ?? null,
      watchTimeMinutes: 0,
    };

    titleEntry.count += 1;

    titleEntry.latestWatchedAt = Math.max(
      titleEntry.latestWatchedAt,
      watchedAt,
    );

    titleEntry.rating = averageRatingByTitle.get(title.id) ?? titleEntry.rating;

    titleEntry.mediaType = title.type;
    titleEntry.title = title.title;
    titleEntry.tmdbId = title.tmdb_id;

    titleEntry.coverImage = title.cover_image ?? titleEntry.coverImage ?? null;

    titleEntry.watchTimeMinutes =
      (titleEntry.watchTimeMinutes ?? 0) + runtimeMinutes;

    titleById.set(title.id, titleEntry);

    if (title.type === "movie") {
      const companies = title.production_companies?.length
        ? title.production_companies
        : (title.tmdb_data?.production_companies ?? []);

      for (const company of companies) {
        const existing = studioCounts.get(company.id);

        studioCounts.set(company.id, {
          id: company.id,
          name: company.name,
          logoPath: existing?.logoPath ?? company.logo_path ?? null,
          count: (existing?.count ?? 0) + 1,
        });
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Episodes                                                               */
  /* ---------------------------------------------------------------------- */

  for (const row of episodeRatingRows) {
    const title = unwrapTitle(row.title ?? row.titles);

    if (!row.watched_at) {
      continue;
    }

    const watchedAt = Date.parse(row.watched_at);

    if (Number.isNaN(watchedAt)) {
      continue;
    }

    const watchedDate = new Date(row.watched_at);

    if (!isWithinRange(watchedDate, monthRange)) {
      continue;
    }

    const watchedDay = toLocalDateKey(watchedDate);

    activeDays.add(watchedDay);

    const runtimeMinutes = Math.max(0, row.runtime_minutes ?? 0);

    const activity = dailyActivity.get(watchedDay) ?? {
      entries: 0,
      moviesWatched: 0,
      episodesWatched: 0,
      minutes: 0,
    };

    activity.entries += 1;
    activity.episodesWatched += 1;
    activity.minutes += runtimeMinutes;

    dailyActivity.set(watchedDay, activity);

    if (!title || title.type !== "tv") {
      continue;
    }

    episodesWatched += 1;
    seriesRuntimeMinutes += runtimeMinutes;

    if (row.watch_type === "rewatch") {
      rewatches += 1;
    }

    addGenreConsumption(genres, title, runtimeMinutes);

    recordTopActorStats(actorStats, title, title.id);

    /*
     * Put series in titleById too.
     *
     * Previously the title aggregation was created only by diary rows,
     * which meant episode-driven series could be missing from title-level
     * rating and ranking statistics.
     */
    const titleEntry = titleById.get(title.id) ?? {
      count: 0,
      latestWatchedAt: watchedAt,
      mediaType: "tv",
      rating: averageRatingByTitle.get(title.id) ?? null,
      title: title.title,
      titleId: title.id,
      tmdbId: title.tmdb_id,
      coverImage: title.cover_image ?? null,
      watchTimeMinutes: 0,
    };

    titleEntry.count += 1;

    titleEntry.latestWatchedAt = Math.max(
      titleEntry.latestWatchedAt,
      watchedAt,
    );

    titleEntry.mediaType = "tv";
    titleEntry.title = title.title;
    titleEntry.tmdbId = title.tmdb_id;

    titleEntry.rating = averageRatingByTitle.get(title.id) ?? titleEntry.rating;

    titleEntry.coverImage = title.cover_image ?? titleEntry.coverImage ?? null;

    titleEntry.watchTimeMinutes =
      (titleEntry.watchTimeMinutes ?? 0) + runtimeMinutes;

    titleById.set(title.id, titleEntry);

    const seriesEntry = seriesByTitle.get(title.id) ?? {
      titleId: title.id,
      tmdbId: title.tmdb_id,
      title: title.title,
      count: 0,
      coverImage: title.cover_image ?? null,
      watchTimeMinutes: 0,
      percentageOfTvTime: 0,
      rating: averageRatingByTitle.get(title.id) ?? null,
      firstWatchedAt: watchedAt,
    };

    seriesEntry.count += 1;

    seriesEntry.firstWatchedAt = Math.min(
      seriesEntry.firstWatchedAt,
      watchedAt,
    );

    seriesEntry.title = title.title;
    seriesEntry.tmdbId = title.tmdb_id;

    seriesEntry.coverImage =
      title.cover_image ?? seriesEntry.coverImage ?? null;

    seriesEntry.rating =
      averageRatingByTitle.get(title.id) ?? seriesEntry.rating;

    seriesEntry.watchTimeMinutes =
      (seriesEntry.watchTimeMinutes ?? 0) + runtimeMinutes;

    seriesByTitle.set(title.id, seriesEntry);
  }

  /*
   * Percentage is calculated only after the entire month has been
   * accumulated so each series knows its share of total TV consumption.
   */
  for (const series of seriesByTitle.values()) {
    series.percentageOfTvTime =
      seriesRuntimeMinutes > 0
        ? ((series.watchTimeMinutes ?? 0) / seriesRuntimeMinutes) * 100
        : 0;
  }

  /* ---------------------------------------------------------------------- */
  /* Finished series                                                        */
  /* ---------------------------------------------------------------------- */

  for (const series of watchedSeries) {
    if (!series.is_series_completed) {
      continue;
    }

    const completedAt = series.latest_watched_at
      ? Date.parse(series.latest_watched_at)
      : null;

    if (completedAt == null || Number.isNaN(completedAt)) {
      continue;
    }

    const completedDate = new Date(series.latest_watched_at);

    if (!isWithinRange(completedDate, monthRange)) {
      continue;
    }

    const monthlySeries = seriesByTitle.get(series.id);

    finishedSeries.set(series.id, {
      titleId: series.id,
      tmdbId: series.tmdb_id,
      title: series.title,

      count: monthlySeries?.count ?? series.watched_episode_count,

      seasonCount: series.total_seasons ?? null,

      episodeCount: series.total_episodes ?? series.watched_episode_count,

      rating: series.latest_rating,

      coverImage: series.cover_image ?? null,

      watchTimeMinutes: monthlySeries?.watchTimeMinutes ?? 0,

      percentageOfTvTime: monthlySeries?.percentageOfTvTime ?? 0,
    });
  }

  const totalWatchTimeMinutes = movieRuntimeMinutes + seriesRuntimeMinutes;

  const averageRating =
    ratingValues.length > 0
      ? ratingValues.reduce((sum, rating) => sum + rating, 0) /
        ratingValues.length
      : null;

  return {
    activeDays,
    episodesWatched,
    dailyActivity,

    movieRuntimeMinutes,
    seriesRuntimeMinutes,
    movieWatchCount,

    ratingsCount,
    rewatches,

    seriesByTitle,
    titleById,

    timeWatchedMinutes: totalWatchTimeMinutes,

    ratings: ratingValues,

    averageRating,

    genreStats: calculateMonthlyGenreStats(genres, 5),

    topActor: calculateTopActor(actorStats),

    studioStats: Array.from(studioCounts.values())
      .map((company) => ({
        ...company,

        percentage:
          movieWatchCount > 0 ? (company.count / movieWatchCount) * 100 : 0,
      }))
      .sort(
        (left, right) =>
          right.count - left.count || left.name.localeCompare(right.name),
      ),

    ratedHighlights: calculateRatedHighlights(ratingRowsForSummary, 2),

    finishedSeries: Array.from(finishedSeries.values()).sort(
      (left, right) =>
        (right.watchTimeMinutes ?? 0) - (left.watchTimeMinutes ?? 0) ||
        right.count - left.count ||
        left.title.localeCompare(right.title),
    ),
  };
}

function isWithinRange(watchedAt: Date, monthRange?: MonthRange) {
  if (!monthRange) {
    return true;
  }

  return watchedAt >= monthRange.start && watchedAt < monthRange.end;
}

function isRatingWithinRange(row: RatingEventRow, monthRange?: MonthRange) {
  if (!monthRange) {
    return true;
  }

  const watchedAt = Date.parse(row.watched_at);

  if (Number.isNaN(watchedAt)) {
    return false;
  }

  return isWithinRange(new Date(row.watched_at), monthRange);
}

function addGenreConsumption(
  genres: Map<
    number,
    {
      count: number;
      name: string;
      watchTimeMinutes: number;
    }
  >,
  title: JoinedTitleRow,
  runtimeMinutes: number,
) {
  const validGenres =
    title.genres?.filter((genre) => genre?.id != null && Boolean(genre.name)) ??
    [];

  if (validGenres.length === 0) {
    return;
  }

  const countWeight = 1 / validGenres.length;

  const runtimeWeight = Math.max(0, runtimeMinutes) / validGenres.length;

  for (const genre of validGenres) {
    const existing = genres.get(genre.id) ?? {
      count: 0,
      name: genre.name,
      watchTimeMinutes: 0,
    };

    existing.count += countWeight;
    existing.watchTimeMinutes += runtimeWeight;
    existing.name = genre.name;

    genres.set(genre.id, existing);
  }
}

function calculateMonthlyGenreStats(
  genres: Map<
    number,
    {
      count: number;
      name: string;
      watchTimeMinutes: number;
    }
  >,
  limit: number,
): ProfileGenreStat[] {
  const totalMinutes = Array.from(genres.values()).reduce(
    (sum, genre) => sum + genre.watchTimeMinutes,
    0,
  );

  return Array.from(genres.entries())
    .map(([genreId, { count, name, watchTimeMinutes }]) => ({
      genreId,
      name,
      count,
      watchTimeMinutes,

      percentage:
        totalMinutes > 0 ? (watchTimeMinutes / totalMinutes) * 100 : 0,
    }))
    .sort(
      (left, right) =>
        (right.watchTimeMinutes ?? 0) - (left.watchTimeMinutes ?? 0) ||
        right.count - left.count ||
        left.name.localeCompare(right.name),
    )
    .slice(0, limit);
}

function recordTopActorStats(
  actorStats: Map<
    string,
    {
      id: number | string;
      name: string;
      profilePath: string | null;
      count: number;
      titles: Set<string>;
    }
  >,
  title: JoinedTitleRow,
  watchedTitleId: string,
) {
  const cast = uniqueCastMembers(title.cast ?? []);

  if (!cast.length) return;

  for (const person of cast) {
    const key = getActorKey(person);
    const entry = actorStats.get(key) ?? {
      id: person.id,
      name: person.name,
      profilePath: person.profile_path ?? null,
      count: 0,
      titles: new Set<string>(),
    };

    entry.count += 1;
    entry.titles.add(watchedTitleId);
    if (!entry.profilePath && person.profile_path) {
      entry.profilePath = person.profile_path;
    }
    actorStats.set(key, entry);
  }
}

function calculateTopActor(
  actorStats: Map<
    string,
    {
      id: number | string;
      name: string;
      profilePath: string | null;
      count: number;
      titles: Set<string>;
    }
  >,
): ProfileMonthlyRecapPersonStat | null {
  const top = Array.from(actorStats.values()).sort(
    (left, right) =>
      right.count - left.count ||
      right.titles.size - left.titles.size ||
      left.name.localeCompare(right.name),
  )[0];

  if (!top || top.count <= 0) return null;

  return {
    id: top.id,
    name: top.name,
    count: top.count,
    distinctTitles: top.titles.size,
    profilePath: top.profilePath,
  };
}

function uniqueCastMembers(cast: TMDbCast[]) {
  const seen = new Set<string>();
  const unique: TMDbCast[] = [];

  for (const person of cast) {
    if (!person?.name) continue;
    const key = getActorKey(person);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(person);
  }

  return unique;
}

function getActorKey(person: TMDbCast) {
  return typeof person.id === "number" && Number.isFinite(person.id)
    ? `id:${person.id}`
    : `name:${normalizeKey(person.name)}`;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function unwrapTitle(title: JoinedTitle) {
  if (Array.isArray(title)) return title[0] ?? null;
  return title ?? null;
}

function productionCompaniesForTitle(
  title: JoinedTitleRow | null | undefined,
): TMDbProductionCompany[] {
  if (title?.production_companies?.length) {
    return title.production_companies;
  }

  return title?.tmdb_data?.production_companies ?? [];
}

function sumWatchTime(
  rows: WatchEventRow[],
  type: MediaType,
  selectRuntime: (
    title: {
      runtime?: number | null;
      episode_runtime?: number | null;
    },
    row: WatchEventRow,
  ) => number | null,
  days: Set<string>,
) {
  let total = 0;

  for (const row of rows) {
    const title = unwrapTitle(row.title ?? row.titles);
    if (!title || title.type !== type || !row.watched_at) continue;

    days.add(new Date(row.watched_at).toISOString().slice(0, 10));
    const runtime = selectRuntime(title, row);
    if (runtime != null) total += runtime;
  }

  return total;
}

function utcDayOfWeek(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).getUTCDay();
}

function buildMediaSplit(value: {
  movies: number;
  series: number;
}): ProfileMediaSplit {
  const total = value.movies + value.series;

  return {
    movies: value.movies,
    series: value.series,
    moviePercentage: total > 0 ? (value.movies / total) * 100 : 0,
    seriesPercentage: total > 0 ? (value.series / total) * 100 : 0,
    dominantType:
      value.movies > value.series
        ? "movie"
        : value.series > value.movies
          ? "series"
          : null,
  };
}

function calculateLongestStreak(days: Set<string>) {
  const sortedDays = Array.from(days).sort();
  let longest = 0;
  let current = 0;
  let previousDay: string | null = null;

  for (const day of sortedDays) {
    if (previousDay && areConsecutiveDays(previousDay, day)) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
    previousDay = day;
  }

  return longest;
}

function areConsecutiveDays(left: string, right: string) {
  const leftDate = Date.UTC(
    Number(left.slice(0, 4)),
    Number(left.slice(5, 7)) - 1,
    Number(left.slice(8, 10)),
  );
  const rightDate = Date.UTC(
    Number(right.slice(0, 4)),
    Number(right.slice(5, 7)) - 1,
    Number(right.slice(8, 10)),
  );
  return rightDate - leftDate === 24 * 60 * 60 * 1000;
}

function calculateStudioStats(rows: WatchEventRow[]): ProfileStudioStat[] {
  const counts = new Map<
    number,
    {
      id: number;
      name: string;
      logoPath: string | null;
      count: number;
    }
  >();

  let total = 0;

  for (const row of rows) {
    const title = resolveJoinedTitle(row.title ?? row.titles);

    if (!title || title.type !== "movie") continue;

    const companies = title.production_companies?.length
      ? title.production_companies
      : (title.tmdb_data?.production_companies ?? []);
    const logoByCompanyId = new Map(
      companies.map((company) => [company.id, company.logo_path ?? null]),
    );

    for (const company of companies) {
      const existing = counts.get(company.id);

      counts.set(company.id, {
        id: company.id,
        name: company.name,
        logoPath:
          existing?.logoPath ??
          company.logo_path ??
          logoByCompanyId.get(company.id) ??
          null,
        count: (existing?.count ?? 0) + 1,
      });

      total += 1;
    }
  }

  return [...counts.values()]
    .map((company) => ({
      ...company,
      percentage: total > 0 ? (company.count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function resolveJoinedTitle(title: JoinedTitle) {
  if (Array.isArray(title)) return title[0] ?? null;
  return title ?? null;
}

function normalizeRating(value: number | string | null) {
  if (value == null) return null;
  const rating = Number(value);
  if (!Number.isFinite(rating)) return null;
  return rating;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ratingSteps() {
  return Array.from({ length: 10 }, (_, index) => (index + 1) / 2);
}

function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}
