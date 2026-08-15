import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProfileMonthlyRecap,
  calculateProfileGenreStats,
  calculateProfileMediaStats,
  calculateProfileRatingStats,
  calculateProfileViewingBreakdownStats,
  createMonthRange,
} from "./profile-stats.ts";
import { transformTVToTitleDetails } from "./tmdb.ts";

function ratedMovieRow(titleId, rating, watchedAt, metadata = {}) {
  return {
    title_id: titleId,
    rating,
    watched_at: watchedAt,
    titles: {
      id: titleId,
      title: titleId,
      type: "movie",
      genres: [],
      cast: [],
      production_companies: [{ id: 1, name: "Test Studio", logo_path: null }],
      release_year: 2000,
      ...metadata,
    },
  };
}

function ratedEpisodeRow(
  titleId,
  rating,
  seasonNumber,
  episodeNumber,
  watchedAt = "2026-08-01T00:00:00.000Z",
  metadata = {},
) {
  return {
    title_id: titleId,
    rating,
    watched_at: watchedAt,
    season_number: seasonNumber,
    episode_number: episodeNumber,
    titles: {
      id: titleId,
      title: titleId,
      type: "tv",
      genres: [],
      cast: [],
      production_companies: [{ id: 1, name: "Test Studio", logo_path: null }],
      release_year: 2000,
      ...metadata,
    },
  };
}

function person(name, order, gender = 2) {
  const id = { Lead: 1, Support: 2, One: 3, Consistent: 4 }[name] ?? 100;
  return { id, name, gender, order, profile_path: null };
}

function movieDiaryRow(
  titleId,
  watchedAt,
  runtime,
  watchType = "first-time",
  metadata = {},
) {
  return {
    title_id: titleId,
    watched_at: watchedAt,
    watch_type: watchType,
    titles: {
      id: titleId,
      title: titleId,
      type: "movie",
      genres: [],
      cast: [],
      production_companies: [],
      release_year: 2000,
      runtime,
      ...metadata,
    },
  };
}

function episodeDiaryRow(
  titleId,
  watchedAt,
  runtimeMinutes,
  watchType = "first-time",
  metadata = {},
) {
  return {
    title_id: titleId,
    watched_at: watchedAt,
    watch_type: watchType,
    runtime_minutes: runtimeMinutes,
    titles: {
      id: titleId,
      title: titleId,
      type: "tv",
      genres: [],
      cast: [],
      production_companies: [],
      release_year: 2000,
      episode_runtime: runtimeMinutes,
      ...metadata,
    },
  };
}

function movieDiary(titleId, watchedAt) {
  return movieDiaryRow(titleId, watchedAt, 120);
}

function movieRating(titleId, rating, watchedAt = "2026-01-01T00:00:00.000Z") {
  return ratedMovieRow(titleId, rating, watchedAt);
}

function episodeRow(titleId, rating, watchedAt = "2026-01-01T00:00:00.000Z") {
  return ratedEpisodeRow(titleId, rating, 1, 1, watchedAt);
}

function watchedSeries(id, watchedEpisodeCount) {
  return {
    id,
    type: "tv",
    title: id,
    tmdb_id: 1000,
    watched_episode_count: watchedEpisodeCount,
    latest_rating: 4,
    latest_watched_at: "2026-01-02T00:00:00.000Z",
    last_episode: {
      season: 1,
      episode: 1,
    },
  };
}

function makeSharedRecapRows() {
  const movieA = movieDiaryRow(
    "runner-up",
    "2026-01-02T12:00:00.000Z",
    90,
    "first-time",
    {
      title: "Runner Up",
      tmdb_id: 101,
    },
  );
  const movieB = movieDiaryRow(
    "winner",
    "2026-01-03T12:00:00.000Z",
    150,
    "first-time",
    {
      title: "Winner",
      tmdb_id: 102,
    },
  );
  const movieC = movieDiaryRow(
    "third",
    "2026-01-04T12:00:00.000Z",
    120,
    "first-time",
    {
      title: "Third",
      tmdb_id: 103,
    },
  );

  return {
    diaryRows: [movieA, movieB, movieC],
    movieRatingRows: [
      movieRating("runner-up", 4.5, "2026-01-02T12:00:00.000Z"),
      movieRating("winner", 4.5, "2026-01-03T12:00:00.000Z"),
      movieRating("third", 4, "2026-01-04T12:00:00.000Z"),
    ],
    episodeRatingRows: [],
  };
}

test("uses the latest movie rating once for lifetime contributor confidence", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("movie-a", 5, "2026-08-01T10:00:00.000Z"),
    ratedMovieRow("movie-a", 2, "2026-08-02T10:00:00.000Z"),
    ratedMovieRow("movie-b", 4.5, "2026-08-03T10:00:00.000Z"),
    ratedMovieRow("movie-c", 4.5, "2026-08-04T10:00:00.000Z"),
  ]);

  assert.equal(stats.highestRatedStudio?.titleCount, 3);
  assert.equal(stats.highestRatedStudio?.average, 11 / 3);
});

test("counts a series once using distinct episode keys", () => {
  const stats = calculateProfileRatingStats([
    ratedEpisodeRow("series-a", 5, 1, 1),
    ratedEpisodeRow("series-a", 1, 1, 1, "2026-08-02T00:00:00.000Z"),
    ratedEpisodeRow("series-a", 4, 1, 2),
    ratedEpisodeRow("series-b", 4, 1, 1),
    ratedEpisodeRow("series-c", 4, 1, 1),
  ]);

  assert.equal(stats.highestRatedStudio?.titleCount, 3);
  assert.equal(stats.highestRatedStudio?.average, 3.5);
});

test("applies cast billing weights and ignores positions after fourteen", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("lead", 5, "2026-01-01T00:00:00.000Z", {
      cast: [person("Consistent", 0)],
    }),
    ratedMovieRow("support", 4, "2026-01-02T00:00:00.000Z", {
      cast: [person("Consistent", 5)],
    }),
    ratedMovieRow("minor", 3.5, "2026-01-03T00:00:00.000Z", {
      cast: [person("Consistent", 12)],
    }),
    ratedMovieRow("ignored", 1, "2026-01-04T00:00:00.000Z", {
      cast: [person("Consistent", 15)],
    }),
  ]);

  assert.equal(stats.highestRatedActor?.titleCount, 3);
  assert.equal(stats.highestRatedActor?.count, 3);
  assert.equal(stats.highestRatedActor?.average, 9 / 2.05);
});

test("Bayesian confidence favors repeated strong work over a low-sample perfect result", () => {
  const stats = calculateProfileRatingStats([
    ...["one", "two", "three"].map((id, index) =>
      ratedMovieRow(
        id,
        5,
        `2026-02-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        {
          cast: [person("One", 10)],
        },
      ),
    ),
    ...["four", "five", "six", "seven", "eight", "nine", "ten"].map(
      (id, index) =>
        ratedMovieRow(
          id,
          4.8,
          `2026-02-${String(index + 4).padStart(2, "0")}T00:00:00.000Z`,
          {
            cast: [person("Consistent", 10)],
          },
        ),
    ),
    ...["eleven", "twelve", "thirteen", "fourteen", "fifteen"].map(
      (id, index) =>
        ratedMovieRow(
          id,
          3,
          `2026-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        ),
    ),
  ]);

  assert.equal(stats.highestRatedActor?.name, "Consistent");
});

test("uses Bayesian eligibility for highest-rated genres and decades", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("genre-a", 5, "2026-04-01T00:00:00.000Z", {
      genres: [{ id: 1, name: "Drama" }],
      release_year: 1999,
    }),
    ratedMovieRow("genre-b", 4.5, "2026-04-02T00:00:00.000Z", {
      genres: [{ id: 1, name: "Drama" }],
      release_year: 1998,
    }),
    ratedMovieRow("genre-c", 4.5, "2026-04-03T00:00:00.000Z", {
      genres: [{ id: 1, name: "Drama" }],
      release_year: 1997,
    }),
    ratedMovieRow("genre-d", 5, "2026-04-04T00:00:00.000Z", {
      genres: [{ id: 2, name: "Comedy" }],
      release_year: 2000,
    }),
  ]);

  assert.equal(stats.highestRatedGenre?.id, 1);
  assert.equal(stats.highestRatedGenre?.titleCount, 3);
  assert.equal(stats.highestRatedDecade?.startYear, 1990);
  assert.equal(stats.highestRatedDecade?.titleCount, 3);
});

test("uses stable genre IDs to break highest-rated ties", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("genre-a", 4, "2026-05-01T00:00:00.000Z", {
      genres: [{ id: 2, name: "B" }],
    }),
    ratedMovieRow("genre-b", 4, "2026-05-02T00:00:00.000Z", {
      genres: [{ id: 1, name: "A" }],
    }),
    ratedMovieRow("genre-c", 4, "2026-05-03T00:00:00.000Z", {
      genres: [{ id: 2, name: "B" }],
    }),
    ratedMovieRow("genre-d", 4, "2026-05-04T00:00:00.000Z", {
      genres: [{ id: 1, name: "A" }],
    }),
    ratedMovieRow("genre-e", 4, "2026-05-05T00:00:00.000Z", {
      genres: [{ id: 1, name: "A" }],
    }),
    ratedMovieRow("genre-f", 4, "2026-05-06T00:00:00.000Z", {
      genres: [{ id: 2, name: "B" }],
    }),
  ]);

  assert.equal(stats.highestRatedGenre?.id, 1);
});

test("skips people without gender classification and below lifetime eligibility", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("unknown", 5, "2026-06-01T00:00:00.000Z", {
      cast: [person("Unknown", 0, 0)],
    }),
    ratedMovieRow("nonbinary", 5, "2026-06-02T00:00:00.000Z", {
      cast: [person("Non-binary", 0, 3)],
    }),
    ...["missing-a", "missing-b", "missing-c"].map((id, index) =>
      ratedMovieRow(id, 5, `2026-06-0${index + 3}T00:00:00.000Z`, {
        cast: [person("No Order", undefined, 2)],
      }),
    ),
  ]);

  assert.equal(stats.highestRatedActor, null);
  assert.equal(stats.highestRatedActress, null);
});

test("persists the tv episode runtime from tmdb into title details", () => {
  const tmdb = {
    getBackdropUrl: () => "backdrop",
    getImageUrl: () => "poster",
  };
  const details = transformTVToTitleDetails(
    tmdb,
    {
      episode_run_time: [42, 41],
      first_air_date: "2020-01-01",
      genres: [],
      id: 123,
      name: "Series",
      number_of_episodes: 8,
      number_of_seasons: 1,
      overview: "Overview",
      poster_path: null,
      backdrop_path: null,
      status: "Ended",
      vote_average: 0,
      vote_count: 0,
      genre_ids: [],
    },
    { cast: [], crew: [] },
  );

  assert.equal(details.episodeRuntime, 42);
});

test("weights watched titles across genres and keeps percentages readable", () => {
  const genres = calculateProfileGenreStats([
    {
      title: {
        id: "title-a",
        title: "Title A",
        type: "movie",
        genres: [
          { id: 1, name: "Drama" },
          { id: 2, name: "Thriller" },
        ],
      },
    },
    {
      title: {
        id: "title-b",
        title: "Title B",
        type: "movie",
        genres: [{ id: 1, name: "Drama" }],
      },
    },
  ]);

  assert.equal(genres[0].name, "Drama");
  assert.equal(Math.round(genres[0].percentage), 75);
});

test("calculates half-star rating buckets and null average for zero ratings", () => {
  const stats = calculateProfileRatingStats([
    { rating: 5 },
    { rating: 4.5 },
    { rating: null },
  ]);

  assert.equal(stats.totalRatings, 2);
  assert.equal(stats.averageRating, 4.8);
  assert.equal(
    stats.distribution.find((bucket) => bucket.rating === 4.5)?.count,
    1,
  );

  const empty = calculateProfileRatingStats([]);

  assert.equal(empty.averageRating, null);
  assert.equal(empty.totalRatings, 0);
  assert.equal(empty.distribution.length, 10);

  assert.equal(empty.highestRatedMovie, null);
  assert.equal(empty.lowestRatedMovie, null);
  assert.equal(empty.highestRatedSeries, null);
  assert.equal(empty.lowestRatedSeries, null);
  assert.equal(empty.movieAverageRating, null);
  assert.equal(empty.seriesAverageRating, null);
  assert.equal(empty.mostRatedGenre, null);
});

test("calculates user rating averages by media type and bucket percentages", () => {
  const stats = calculateProfileRatingStats([
    {
      rating: 4,
      titles: { id: "movie-a", title: "Movie A", type: "movie" },
    },
    {
      rating: 2.5,
      titles: { id: "movie-b", title: "Movie B", type: "movie" },
    },
    {
      rating: 5,
      titles: { id: "series-a", title: "Series A", type: "tv" },
    },
    {
      rating: 3.5,
      titles: { id: "series-a", title: "Series A", type: "tv" },
    },
  ]);

  assert.equal(stats.movieAverageRating, 3.3);
  assert.equal(stats.seriesAverageRating, 4.3);

  const bucket = stats.distribution.find((item) => item.rating === 4);
  assert.deepEqual(bucket, { rating: 4, count: 1, percentage: 25 });
  assert.deepEqual(
    stats.distribution.map((item) => item.rating),
    [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
  );
});

test("calculates the percentage of ratings that are exactly five stars", () => {
  const stats = calculateProfileRatingStats([
    { rating: 5 },
    { rating: 5 },
    { rating: 4.5 },
    { rating: 4 },
    { rating: null },
  ]);

  assert.equal(stats.fiveStarRate, 50);

  const empty = calculateProfileRatingStats([]);

  assert.equal(empty.fiveStarRate, 0);
});

test("finds the highest-rated genre with deterministic tie breaking", () => {
  const stats = calculateProfileRatingStats([
    {
      title_id: "drama-a",
      rating: 4.5,
      titles: {
        id: "drama-a",
        genres: [{ id: 1, name: "Drama" }],
      },
    },
    {
      title_id: "drama-b",
      rating: 4.5,
      titles: {
        id: "drama-b",
        genres: [{ id: 1, name: "Drama" }],
      },
    },
    {
      title_id: "drama-c",
      rating: 4.5,
      titles: {
        id: "drama-c",
        genres: [{ id: 1, name: "Drama" }],
      },
    },

    {
      title_id: "comedy-a",
      rating: 4.5,
      titles: {
        id: "comedy-a",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      title_id: "comedy-b",
      rating: 4.5,
      titles: {
        id: "comedy-b",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      title_id: "comedy-c",
      rating: 4.5,
      titles: {
        id: "comedy-c",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
  ]);

  assert.deepEqual(stats.highestRatedGenre, {
    id: 1,
    name: "Drama",
    average: 4.5,
    count: 3,
    titleCount: 3,
  });

  const empty = calculateProfileRatingStats([]);

  assert.equal(empty.highestRatedGenre, null);
});

test("finds the most-rated genre by rating count rather than average", () => {
  const stats = calculateProfileRatingStats([
    {
      rating: 5,
      titles: {
        id: "title-a",
        genres: [{ id: 1, name: "Thriller" }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-b",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-c",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-d",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
  ]);

  assert.deepEqual(stats.mostRatedGenre, {
    id: 2,
    name: "Comedy",
    average: 4.5,
    count: 3,
    titleCount: 3,
  });
});

test("finds the highest-rated decade from title release years", () => {
  const stats = calculateProfileRatingStats([
    {
      rating: 5,
      titles: {
        id: "title-a",
        release_year: 2012,
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-b",
        release_year: 2018,
      },
    },
    {
      rating: 4,
      titles: {
        id: "title-f",
        release_year: 2015,
      },
    },
    {
      rating: 4,
      titles: {
        id: "title-c",
        release_year: 2007,
      },
    },
    {
      rating: 5,
      titles: {
        id: "title-d",
        release_year: 2001,
      },
    },
    {
      rating: null,
      titles: {
        id: "title-e",
        release_year: 1999,
      },
    },
  ]);

  assert.deepEqual(stats.highestRatedDecade, {
    startYear: 2010,
    average: 4.5,
    count: 3,
    titleCount: 3,
  });

  const empty = calculateProfileRatingStats([]);

  assert.equal(empty.highestRatedDecade, null);
});

test("finds the highest-rated studio with deterministic tie breaking", () => {
  const stats = calculateProfileRatingStats([
    {
      rating: 5,
      titles: {
        id: "title-a",
        production_companies: [{ id: 1, name: "A24" }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-b",
        production_companies: [{ id: 1, name: "A24" }],
      },
    },
    {
      rating: 5,
      titles: {
        id: "title-c",
        production_companies: [{ id: 2, name: "Warner Bros." }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-d",
        production_companies: [{ id: 2, name: "Warner Bros." }],
      },
    },
    {
      rating: 4,
      titles: {
        id: "title-f",
        production_companies: [{ id: 1, name: "A24" }],
      },
    },
    {
      rating: 4,
      titles: {
        id: "title-g",
        production_companies: [{ id: 2, name: "Warner Bros." }],
      },
    },
    {
      rating: null,
      titles: {
        id: "title-e",
        production_companies: [{ id: 3, name: "Universal Pictures" }],
      },
    },
  ]);

  assert.deepEqual(stats.highestRatedStudio, {
    name: "A24",
    average: 4.5,
    count: 3,
    titleCount: 3,
  });

  const empty = calculateProfileRatingStats([]);

  assert.equal(empty.highestRatedStudio, null);
});

test("finds the highest-rated actor and actress from persisted cast gender", () => {
  const stats = calculateProfileRatingStats([
    {
      rating: 5,
      titles: {
        id: "title-a",
        cast: [
          { id: 1, name: "Actor A", gender: 2, order: 0, profile_path: null },
          { id: 2, name: "Actress A", gender: 1, order: 0, profile_path: null },
        ],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-b",
        cast: [
          { id: 1, name: "Actor A", gender: 2, order: 0, profile_path: null },
          { id: 2, name: "Actress A", gender: 1, order: 0, profile_path: null },
        ],
      },
    },
    {
      rating: 5,
      titles: {
        id: "title-c",
        cast: [
          { id: 3, name: "Actor B", gender: 2, order: 0, profile_path: null },
          { id: 4, name: "Actress B", gender: 1, order: 0, profile_path: null },
        ],
      },
    },
    {
      rating: 4,
      titles: {
        id: "title-d",
        cast: [
          { id: 3, name: "Actor B", gender: 2, order: 0, profile_path: null },
          { id: 4, name: "Actress B", gender: 1, order: 0, profile_path: null },
        ],
      },
    },
    {
      rating: 5,
      titles: {
        id: "title-e",
        cast: [
          { id: 5, name: "Unknown", gender: 0, profile_path: null },
          { id: 6, name: "Non-binary", gender: 3, profile_path: null },
        ],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-f",
        cast: [
          { id: 1, name: "Actor A", gender: 2, order: 0, profile_path: null },
          { id: 2, name: "Actress A", gender: 1, order: 0, profile_path: null },
        ],
      },
    },
  ]);

  assert.deepEqual(stats.highestRatedActor, {
    name: "Actor A",
    average: 14 / 3,
    count: 3,
    titleCount: 3,
  });

  assert.deepEqual(stats.highestRatedActress, {
    name: "Actress A",
    average: 14 / 3,
    count: 3,
    titleCount: 3,
  });

  const empty = calculateProfileRatingStats([]);

  assert.equal(empty.highestRatedActor, null);
  assert.equal(empty.highestRatedActress, null);
});

test("calculates profile media stats with unrated movies excluded from averages", () => {
  const stats = calculateProfileMediaStats({
    seriesWatched: 7,
    watchedMovies: [{ rating: 0 }, { rating: 3 }, { rating: 4.5 }],
    watchedSeries: [{ id: "series-a" }, { id: "series-b" }],
    seriesRatings: {
      "series-a": 0,
      "series-b": 4,
    },
  });

  assert.deepEqual(stats, {
    seriesWatched: 7,
    movieRatings: {
      average: 3.75,
      ratedCount: 2,
    },
    seriesRatings: {
      average: 4,
      ratedCount: 1,
    },
  });
});

test("returns null media averages when no titles are rated", () => {
  assert.deepEqual(
    calculateProfileMediaStats({
      seriesWatched: 0,
      watchedMovies: [{ rating: 0 }, { rating: null }],
      watchedSeries: [{ id: "series-a" }],
      seriesRatings: { "series-a": 0 },
    }),
    {
      seriesWatched: 0,
      movieRatings: {
        average: null,
        ratedCount: 0,
      },
      seriesRatings: {
        average: null,
        ratedCount: 0,
      },
    },
  );
});

test("calculates viewing breakdown stats from watched movies, episodes, streaks, and studios", () => {
  const stats = calculateProfileViewingBreakdownStats({
    diaryRows: [
      {
        title_id: "movie-a",
        watched_at: "2026-08-01T12:00:00.000Z",
        watch_type: "first-time",
        titles: {
          id: "movie-a",
          title: "Movie A",
          type: "movie",
          genres: [],
          production_companies: [
            { id: 1, name: "Studio One", logo_path: "/studio-one.png" },
          ],
          runtime: 120,
          episode_runtime: null,
        },
      },
      {
        title_id: "movie-b",
        watched_at: "2026-08-02T12:00:00.000Z",
        watch_type: "rewatch",
        titles: {
          id: "movie-b",
          title: "Movie B",
          type: "movie",
          genres: [],
          production_companies: [],
          tmdb_data: {
            production_companies: [
              { id: 2, name: "Studio Two", logo_path: "/studio-two.png" },
            ],
          },
          runtime: 90,
          episode_runtime: null,
        },
      },
      {
        title_id: "movie-a",
        watched_at: "2026-08-03T12:00:00.000Z",
        watch_type: "rewatch",
        titles: {
          id: "movie-a",
          title: "Movie A",
          type: "movie",
          genres: [],
          production_companies: [
            { id: 1, name: "Studio One", logo_path: "/studio-one.png" },
          ],
          runtime: 120,
          episode_runtime: null,
        },
      },
    ],
    episodeRows: [
      {
        title_id: "series-a",
        watched_at: "2026-08-01T12:00:00.000Z",
        titles: {
          id: "series-a",
          title: "Series A",
          type: "tv",
          genres: [],
          production_companies: [],
          runtime: null,
          episode_runtime: 45,
        },
      },
      {
        title_id: "series-a",
        watched_at: "2026-08-02T12:00:00.000Z",
        titles: {
          id: "series-a",
          title: "Series A",
          type: "tv",
          genres: [],
          production_companies: [],
          runtime: null,
          episode_runtime: 45,
        },
      },
      {
        title_id: "series-a",
        watched_at: "2026-08-02T13:00:00.000Z",
        titles: {
          id: "series-a",
          title: "Series A",
          type: "tv",
          genres: [],
          production_companies: [],
          runtime: null,
          episode_runtime: 45,
        },
      },
      {
        title_id: "series-a",
        watched_at: "2026-08-02T14:00:00.000Z",
        titles: {
          id: "series-a",
          title: "Series A",
          type: "tv",
          genres: [],
          production_companies: [],
          runtime: null,
          episode_runtime: 45,
        },
      },
      {
        title_id: "series-b",
        watched_at: "2026-08-04T12:00:00.000Z",
        titles: {
          id: "series-b",
          title: "Series B",
          type: "tv",
          genres: [],
          production_companies: [],
          runtime: null,
          episode_runtime: 30,
        },
      },
    ],
  });

  assert.equal(stats.movieTimeWatchedMinutes, 330);
  assert.equal(stats.tvTimeWatchedMinutes, 210);
  assert.equal(stats.longestMovieStreakDays, 3);
  assert.equal(stats.longestSeriesStreakDays, 2);
  assert.equal(stats.studioStats[0].name, "Studio One");
  assert.equal(stats.studioStats[0].count, 2);
  assert.equal(stats.studioStats[0].logoPath, "/studio-one.png");
  assert.equal(stats.studioStats[1].name, "Studio Two");
  assert.equal(stats.studioStats[1].count, 1);
  assert.equal(stats.studioStats[1].logoPath, "/studio-two.png");
  assert.equal(stats.averageMovieRuntimeMinutes, 110);
  assert.equal(stats.averageEpisodesPerSeries, 2.5);
  assert.equal(stats.longestBingeEpisodes, 3);
});

test("calculates weekday and weekend media splits from watch events", () => {
  const movieTitle = {
    id: "movie-a",
    title: "Movie A",
    type: "movie",
    runtime: 120,
  };
  const seriesTitle = {
    id: "series-a",
    title: "Series A",
    type: "tv",
    episode_runtime: 45,
  };

  const stats = calculateProfileViewingBreakdownStats({
    diaryRows: [
      {
        title_id: "movie-a",
        watched_at: "2026-08-10T12:00:00.000Z",
        watch_type: "first-time",
        titles: movieTitle,
      },
      {
        title_id: "movie-a",
        watched_at: "2026-08-11T12:00:00.000Z",
        watch_type: "rewatch",
        titles: movieTitle,
      },
      {
        title_id: "movie-a",
        watched_at: "2026-08-15T12:00:00.000Z",
        watch_type: "rewatch",
        titles: movieTitle,
      },
      {
        title_id: "movie-a",
        watched_at: "2026-08-16T12:00:00.000Z",
        watch_type: "rewatch",
        titles: movieTitle,
      },
      {
        title_id: "movie-a",
        watched_at: "2026-08-16T13:00:00.000Z",
        watch_type: "rewatch",
        titles: movieTitle,
      },
      {
        title_id: "movie-a",
        watched_at: "2026-08-16T14:00:00.000Z",
        watch_type: "rewatch",
        titles: movieTitle,
      },
    ],
    episodeRows: [
      {
        title_id: "series-a",
        watched_at: "2026-08-12T12:00:00.000Z",
        titles: seriesTitle,
      },
      {
        title_id: "series-a",
        watched_at: "2026-08-13T12:00:00.000Z",
        titles: seriesTitle,
      },
      {
        title_id: "series-a",
        watched_at: "2026-08-14T12:00:00.000Z",
        titles: seriesTitle,
      },
      {
        title_id: "series-a",
        watched_at: "2026-08-15T12:00:00.000Z",
        titles: seriesTitle,
      },
    ],
  });

  assert.deepEqual(stats.weekdayMediaSplit, {
    movies: 2,
    series: 3,
    moviePercentage: 40,
    seriesPercentage: 60,
    dominantType: "series",
  });
  assert.deepEqual(stats.weekendMediaSplit, {
    movies: 4,
    series: 1,
    moviePercentage: 80,
    seriesPercentage: 20,
    dominantType: "movie",
  });
});

test("returns finite empty media splits when there are no watch events", () => {
  const stats = calculateProfileViewingBreakdownStats({
    diaryRows: [],
    episodeRows: [],
  });

  assert.deepEqual(stats.weekdayMediaSplit, {
    movies: 0,
    series: 0,
    moviePercentage: 0,
    seriesPercentage: 0,
    dominantType: null,
  });
  assert.deepEqual(stats.weekendMediaSplit, {
    movies: 0,
    series: 0,
    moviePercentage: 0,
    seriesPercentage: 0,
    dominantType: null,
  });
});

test("aggregates movie and episode counts in monthly daily activity", () => {
  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [
        movieDiaryRow("movie-only", "2026-08-10T12:00:00.000Z", 90),
        movieDiaryRow(
          "mixed-movie",
          "2026-08-12T12:00:00.000Z",
          120,
          "rewatch",
        ),
      ],
      movieRatingRows: [],
      episodeRatingRows: [
        episodeDiaryRow("episode-only", "2026-08-11T12:00:00.000Z", 45),
        episodeDiaryRow("mixed-episode", "2026-08-12T13:00:00.000Z", 30),
      ],
    },
    previous: {
      diaryRows: [],
      movieRatingRows: [],
      episodeRatingRows: [],
    },
  });

  assert.equal(recap.moviesWatched, 2);
  assert.equal(recap.episodesWatched, 2);
  assert.equal(recap.timeWatchedMinutes, 285);
  assert.equal(recap.rewatches, 1);
  assert.equal(recap.activeDays, 3);
  assert.deepEqual(recap.dailyActivity, [
    {
      date: "2026-08-10",
      entries: 1,
      moviesWatched: 1,
      episodesWatched: 0,
      minutes: 90,
    },
    {
      date: "2026-08-11",
      entries: 1,
      moviesWatched: 0,
      episodesWatched: 1,
      minutes: 45,
    },
    {
      date: "2026-08-12",
      entries: 2,
      moviesWatched: 1,
      episodesWatched: 1,
      minutes: 150,
    },
  ]);
});

test("lifetime recap preserves repeated movie diary watches and series episode counts", async () => {
  const { buildProfileLifetimeRecap } = await import("@kino/core");

  const recap = buildProfileLifetimeRecap({
    lifetime: {
      moviesWatched: 2,
      episodesWatched: 2,
      ratingsMade: 1,
      timeWatchedMinutes: 300,
    },
    diaryRows: [movieDiary("m1", "2026-01-01"), movieDiary("m1", "2026-01-02")],
    movieRatingRows: [movieRating("m1", 5)],
    episodeRatingRows: [episodeRow("s1", null), episodeRow("s1", 4)],
    watchedSeries: [watchedSeries("s1", 47)],
  });

  assert.equal(recap.moviesWatched, 2);
  assert.equal(recap.topRatedMovies[0].count, 2);
  assert.equal(recap.topRatedSeries[0].watchedEpisodeCount, 47);
  assert.equal(recap.topRatedSeries[0].rating, 4);
});

test("lifetime and monthly use the same top-rated title ordering for the same unbounded activity", async () => {
  const { buildProfileMonthlyRecap, buildProfileLifetimeRecap } =
    await import("@kino/core");
  const rows = makeSharedRecapRows();

  const lifetime = buildProfileLifetimeRecap({
    lifetime: {
      moviesWatched: 3,
      episodesWatched: 0,
      ratingsMade: 3,
      timeWatchedMinutes: 360,
    },
    ...rows,
    watchedSeries: [],
  });
  const monthly = buildProfileMonthlyRecap({
    year: 2026,
    month: 1,
    current: { ...rows, watchedSeries: [] },
    previous: { diaryRows: [], movieRatingRows: [], episodeRatingRows: [] },
  });

  assert.deepEqual(
    lifetime.topRatedMovies.map((item) => item.titleId),
    monthly.topRatedMovies.map((item) => item.titleId),
  );
});

test("binge tie source data stays deterministic across episode counts, minutes, and date", () => {
  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [],
      movieRatingRows: [],
      episodeRatingRows: [
        episodeDiaryRow("binge-early-a", "2026-08-09T12:00:00.000Z", 30),
        episodeDiaryRow("binge-early-b", "2026-08-09T13:00:00.000Z", 30),
        episodeDiaryRow("binge-early-c", "2026-08-09T14:00:00.000Z", 30),
        episodeDiaryRow("binge-middle-a", "2026-08-10T12:00:00.000Z", 30),
        episodeDiaryRow("binge-middle-b", "2026-08-10T13:00:00.000Z", 45),
        episodeDiaryRow("binge-middle-c", "2026-08-10T14:00:00.000Z", 30),
        episodeDiaryRow("binge-late-a", "2026-08-11T12:00:00.000Z", 30),
        episodeDiaryRow("binge-late-b", "2026-08-11T13:00:00.000Z", 30),
        episodeDiaryRow("binge-late-c", "2026-08-11T14:00:00.000Z", 30),
      ],
    },
    previous: {
      diaryRows: [],
      movieRatingRows: [],
      episodeRatingRows: [],
    },
  });

  assert.equal(recap.moviesWatched, 0);
  assert.equal(recap.episodesWatched, 9);
  assert.equal(recap.timeWatchedMinutes, 285);
  assert.deepEqual(recap.dailyActivity, [
    {
      date: "2026-08-09",
      entries: 3,
      moviesWatched: 0,
      episodesWatched: 3,
      minutes: 90,
    },
    {
      date: "2026-08-10",
      entries: 3,
      moviesWatched: 0,
      episodesWatched: 3,
      minutes: 105,
    },
    {
      date: "2026-08-11",
      entries: 3,
      moviesWatched: 0,
      episodesWatched: 3,
      minutes: 90,
    },
  ]);
});

test("builds monthly recap studio stats from tmdb company fallback data", () => {
  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [
        {
          title_id: "movie-a",
          watched_at: "2026-08-01T12:00:00.000Z",
          watch_type: "first-time",
          titles: {
            id: "movie-a",
            title: "Movie A",
            type: "movie",
            genres: [],
            production_companies: [],
            tmdb_data: {
              production_companies: [
                { id: 2, name: "Studio Two", logo_path: "/studio-two.png" },
              ],
            },
            runtime: 120,
            episode_runtime: null,
          },
        },
      ],
      movieRatingRows: [],
      episodeRatingRows: [],
    },
    previous: {
      diaryRows: [],
      movieRatingRows: [],
      episodeRatingRows: [],
    },
  });

  assert.equal(recap.mostWatchedStudio?.name, "Studio Two");
  assert.equal(recap.mostWatchedStudio?.logoPath, "/studio-two.png");
});

test("monthly highest-rated categories use only the supplied current-month rows", () => {
  const currentMovieA = ratedMovieRow("aug-a", 5, "2026-08-02T00:00:00.000Z", {
    genres: [{ id: 1, name: "Drama" }],
  });
  const currentMovieB = ratedMovieRow(
    "aug-b",
    4.5,
    "2026-08-03T00:00:00.000Z",
    {
      genres: [{ id: 1, name: "Drama" }],
    },
  );
  const previousMovie = ratedMovieRow("jul-a", 5, "2026-07-31T00:00:00.000Z", {
    genres: [{ id: 2, name: "Comedy" }],
  });

  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [],
      movieRatingRows: [currentMovieA, currentMovieB],
      episodeRatingRows: [],
    },
    previous: {
      diaryRows: [],
      movieRatingRows: [previousMovie],
      episodeRatingRows: [],
    },
  });

  assert.equal(recap.highestRatedGenre?.id, 1);
  assert.equal(recap.highestRatedGenre?.titleCount, 2);
  assert.equal(recap.highestRatedActor, null);
});

test("month-bounded recaps ignore out-of-range rating rows", () => {
  const inMonthWatch = movieDiaryRow(
    "aug-watch",
    "2026-08-02T12:00:00.000Z",
    100,
    "first-time",
    {
      title: "August Watch",
      genres: [{ id: 1, name: "Drama" }],
    },
  );
  const inMonthRatingA = ratedMovieRow(
    "aug-a",
    4,
    "2026-08-03T00:00:00.000Z",
    {
      title: "August A",
      genres: [{ id: 1, name: "Drama" }],
    },
  );
  const inMonthRatingB = ratedMovieRow(
    "aug-b",
    3,
    "2026-08-04T00:00:00.000Z",
    {
      title: "August B",
      genres: [{ id: 1, name: "Drama" }],
    },
  );
  const outOfMonthRating = ratedMovieRow(
    "aug-watch",
    5,
    "2026-07-31T00:00:00.000Z",
    {
      title: "August Watch",
      genres: [{ id: 2, name: "Comedy" }],
    },
  );

  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [inMonthWatch],
      movieRatingRows: [inMonthRatingA, inMonthRatingB, outOfMonthRating],
      episodeRatingRows: [],
    },
    previous: {
      diaryRows: [],
      movieRatingRows: [],
      episodeRatingRows: [],
    },
  });

  assert.equal(recap.ratingsMade, 2);
  assert.equal(recap.averageRating, 3.5);
  assert.equal(recap.topTitles[0].rating, null);
  assert.deepEqual(
    recap.topRatedMovies.map((item) => item.titleId),
    [],
  );
  assert.equal(recap.highestRatedGenre?.id, 1);
  assert.equal(recap.highestRatedGenre?.titleCount, 2);
  assert.equal(recap.highestRatedGenre?.average, 3.5);
});

test("monthly highest-rated fields do not replace most-watched exposure fields", () => {
  const movieA = ratedMovieRow("movie-a", 5, "2026-08-02T00:00:00.000Z");
  const movieB = ratedMovieRow("movie-b", 4.5, "2026-08-03T00:00:00.000Z");

  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [
        { ...movieA, watch_type: "first-time" },
        { ...movieB, watch_type: "first-time" },
      ],
      movieRatingRows: [movieA, movieB],
      episodeRatingRows: [],
    },
    previous: { diaryRows: [], movieRatingRows: [], episodeRatingRows: [] },
  });

  assert.equal(recap.mostWatchedStudio?.count, 2);
  assert.equal(recap.highestRatedStudio?.titleCount, 2);
});

test("creates month ranges and monthly recap comparison deltas", () => {
  const range = createMonthRange(2026, 8);
  assert.equal(range.start.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-01T00:00:00.000Z");

  const ratings = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0];
  const watchedTitles = Array.from({ length: 11 }, (_, index) => {
    const titleNumber = index + 1;
    const id = `title-${titleNumber}`;
    const isMovie = titleNumber % 2 === 1;
    return {
      title_id: id,
      watched_at: `2026-08-${String(titleNumber + 1).padStart(2, "0")}T12:00:00.000Z`,
      watch_type: "first-time",
      titles: {
        id,
        title: `Title ${titleNumber}`,
        type: isMovie ? "movie" : "tv",
        genres: [{ id: titleNumber, name: `Genre ${titleNumber}` }],
        runtime: isMovie ? 120 + titleNumber : null,
        episode_runtime: isMovie ? null : 45 + titleNumber,
      },
    };
  });

  const movieRatingRows = watchedTitles
    .filter((row) => row.titles.type === "movie")
    .map((row) => ({
      title_id: row.title_id,
      watched_at: row.watched_at,
      rating: ratings[Number(row.title_id.split("-")[1]) - 1],
    }));
  const episodeRatingRows = watchedTitles
    .filter((row) => row.titles.type === "tv")
    .map((row) => ({
      title_id: row.title_id,
      watched_at: row.watched_at,
      rating: ratings[Number(row.title_id.split("-")[1]) - 1],
    }));

  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: watchedTitles,
      movieRatingRows,
      episodeRatingRows,
    },
    previous: {
      diaryRows: [],
      movieRatingRows: [],
      episodeRatingRows: [],
    },
  });

  assert.equal(recap.moviesWatched, 6);
  assert.equal(recap.previousMonthComparison.moviesDelta, 6);
  assert.equal(recap.activeDays, 11);
  assert.equal(recap.topTitles.length, 10);
  assert.equal(recap.topTitles[0].title, "Title 11");
  assert.equal(recap.topTitles[0].mediaType, "movie");
  assert.equal(recap.topTitles[1].title, "Title 9");
  assert.equal(recap.topTitles[1].mediaType, "movie");
  assert.equal(recap.topTitles[9].title, "Title 4");
});

test("finds movie extrema from latest ratings and series extrema from episode averages", () => {
  const stats = calculateProfileRatingStats([
    {
      title_id: "movie-a",
      rating: 5,
      watched_at: "2026-08-01T12:00:00.000Z",
      titles: {
        id: "movie-a",
        title: "Movie A",
        type: "movie",
      },
    },
    {
      title_id: "movie-a",
      rating: 2,
      watched_at: "2026-08-03T12:00:00.000Z",
      titles: {
        id: "movie-a",
        title: "Movie A",
        type: "movie",
      },
    },
    {
      title_id: "movie-b",
      rating: 4,
      watched_at: "2026-08-02T12:00:00.000Z",
      titles: {
        id: "movie-b",
        title: "Movie B",
        type: "movie",
      },
    },

    {
      title_id: "series-a",
      rating: 5,
      watched_at: "2026-08-01T13:00:00.000Z",
      titles: {
        id: "series-a",
        title: "Series A",
        type: "tv",
      },
    },
    {
      title_id: "series-a",
      rating: 3,
      watched_at: "2026-08-02T13:00:00.000Z",
      titles: {
        id: "series-a",
        title: "Series A",
        type: "tv",
      },
    },
    {
      title_id: "series-b",
      rating: 2,
      watched_at: "2026-08-01T14:00:00.000Z",
      titles: {
        id: "series-b",
        title: "Series B",
        type: "tv",
      },
    },
    {
      title_id: "series-b",
      rating: 2.5,
      watched_at: "2026-08-02T14:00:00.000Z",
      titles: {
        id: "series-b",
        title: "Series B",
        type: "tv",
      },
    },
  ]);

  assert.deepEqual(stats.highestRatedMovie, {
    titleId: "movie-b",
    title: "Movie B",
    rating: 4,
    ratingCount: 1,
  });

  assert.deepEqual(stats.lowestRatedMovie, {
    titleId: "movie-a",
    title: "Movie A",
    rating: 2,
    ratingCount: 1,
  });

  assert.deepEqual(stats.highestRatedSeries, {
    titleId: "series-a",
    title: "Series A",
    rating: 4,
    ratingCount: 2,
  });

  assert.deepEqual(stats.lowestRatedSeries, {
    titleId: "series-b",
    title: "Series B",
    rating: 2.25,
    ratingCount: 2,
  });
});

test("tracks distinct title counts separately from rating-event counts", () => {
  const sharedMetadata = {
    genres: [{ id: 1, name: "Drama" }],
    production_companies: [{ id: 10, name: "Studio A" }],
    cast: [
      {
        id: 20,
        name: "Actor A",
        gender: 2,
        order: 0,
        profile_path: null,
      },
      {
        id: 30,
        name: "Actress A",
        gender: 1,
        order: 0,
        profile_path: null,
      },
    ],
    release_year: 2016,
    type: "tv",
  };

  const stats = calculateProfileRatingStats([
    {
      title_id: "series-a",
      rating: 5,
      titles: {
        ...sharedMetadata,
        id: "series-a",
        title: "Series A",
      },
    },
    {
      title_id: "series-a",
      rating: 4,
      titles: {
        ...sharedMetadata,
        id: "series-a",
        title: "Series A",
      },
    },
    {
      title_id: "series-b",
      rating: 3,
      titles: {
        ...sharedMetadata,
        id: "series-b",
        title: "Series B",
      },
    },
    {
      title_id: "series-c",
      rating: 4,
      titles: {
        ...sharedMetadata,
        id: "series-c",
        title: "Series C",
      },
    },
  ]);

  // Four rating events, but only three distinct titles.
  assert.equal(stats.highestRatedGenre?.count, 4);
  assert.equal(stats.highestRatedGenre?.titleCount, 3);

  assert.equal(stats.highestRatedDecade?.count, 4);
  assert.equal(stats.highestRatedDecade?.titleCount, 3);

  assert.equal(stats.highestRatedStudio?.count, 4);
  assert.equal(stats.highestRatedStudio?.titleCount, 3);

  assert.equal(stats.highestRatedActor?.count, 4);
  assert.equal(stats.highestRatedActor?.titleCount, 3);

  assert.equal(stats.highestRatedActress?.count, 4);
  assert.equal(stats.highestRatedActress?.titleCount, 3);
});

test("finds the most-rated genre by distinct title count rather than average", () => {
  const stats = calculateProfileRatingStats([
    {
      rating: 5,
      titles: {
        id: "title-a",
        genres: [{ id: 1, name: "Thriller" }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-b",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-c",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      rating: 4.5,
      titles: {
        id: "title-d",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
  ]);

  // Thriller has the higher average, but only one title,
  // so it is ineligible for highest-rated genre.
  assert.deepEqual(stats.highestRatedGenre, {
    id: 2,
    name: "Comedy",
    average: 4.5,
    count: 3,
    titleCount: 3,
  });

  assert.deepEqual(stats.mostRatedGenre, {
    id: 2,
    name: "Comedy",
    average: 4.5,
    count: 3,
    titleCount: 3,
  });
});

test("finds the most-rated genre by distinct titles rather than rating-event volume", () => {
  const repeatedSeriesRatings = Array.from({ length: 6 }, () => ({
    title_id: "series-a",
    rating: 5,
    titles: {
      id: "series-a",
      title: "Series A",
      type: "tv",
      genres: [{ id: 1, name: "Thriller" }],
    },
  }));

  const stats = calculateProfileRatingStats([
    ...repeatedSeriesRatings,
    {
      title_id: "movie-a",
      rating: 4,
      titles: {
        id: "movie-a",
        title: "Movie A",
        type: "movie",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      title_id: "movie-b",
      rating: 4,
      titles: {
        id: "movie-b",
        title: "Movie B",
        type: "movie",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
    {
      title_id: "movie-c",
      rating: 4,
      titles: {
        id: "movie-c",
        title: "Movie C",
        type: "movie",
        genres: [{ id: 2, name: "Comedy" }],
      },
    },
  ]);

  assert.equal(stats.mostRatedGenre?.name, "Comedy");
  assert.equal(stats.mostRatedGenre?.titleCount, 3);

  // Thriller has more rating events, but only one distinct title.
  assert.equal(stats.mostRatedGenre?.count, 3);
});

test("finds the highest-rated genre from per-title averages with a three-title minimum", () => {
  const bingeRatings = Array.from({ length: 8 }, () => ({
    title_id: "drama-series",
    rating: 5,
    titles: {
      id: "drama-series",
      title: "Drama Series",
      type: "tv",
      genres: [{ id: 1, name: "Drama" }],
    },
  }));

  const stats = calculateProfileRatingStats([
    ...bingeRatings,

    // Drama looks excellent if episode ratings are naively pooled,
    // but its three title-level averages are 5, 1 and 1.
    {
      title_id: "drama-movie-a",
      rating: 1,
      titles: {
        id: "drama-movie-a",
        title: "Drama Movie A",
        type: "movie",
        genres: [{ id: 1, name: "Drama" }],
      },
    },
    {
      title_id: "drama-movie-b",
      rating: 1,
      titles: {
        id: "drama-movie-b",
        title: "Drama Movie B",
        type: "movie",
        genres: [{ id: 1, name: "Drama" }],
      },
    },

    // Comedy has three distinct titles, all averaging 4.
    ...["a", "b", "c"].map((suffix) => ({
      title_id: `comedy-${suffix}`,
      rating: 4,
      titles: {
        id: `comedy-${suffix}`,
        title: `Comedy ${suffix}`,
        type: "movie",
        genres: [{ id: 2, name: "Comedy" }],
      },
    })),

    // Horror has the best average but only two titles,
    // so it must not be eligible.
    ...["a", "b"].map((suffix) => ({
      title_id: `horror-${suffix}`,
      rating: 5,
      titles: {
        id: `horror-${suffix}`,
        title: `Horror ${suffix}`,
        type: "movie",
        genres: [{ id: 3, name: "Horror" }],
      },
    })),
  ]);

  assert.deepEqual(stats.highestRatedGenre, {
    id: 2,
    name: "Comedy",
    average: 4,
    count: 3,
    titleCount: 3,
  });
});
