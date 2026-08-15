# Lifetime Recap Story Refactor Design

## Goal

Refactor the lifetime recap story/image so it is a true sibling of the monthly recap: both use the same aggregation semantics, localized-title pipeline, ranked-list behavior, and visual story primitives, while lifetime retains its own lifetime totals and adds localized Kino Time/member-since information.

## Scope boundaries

- Preserve `getProfileLifetimeStatsByProfileId`, `getProfileLifetimeStatsFromTables`, `get_profile_lifetime_stats`, and `ProfileLifetimeStats` semantics and fallback behavior.
- Add a separate richer lifetime recap query and type; do not make the lightweight lifetime-stats fallback load recap metadata.
- Reuse the monthly aggregation definitions for top-rated titles, top genres, and rated highlights.
- Extract only story primitives that are clearly shared by the monthly and lifetime OG routes.
- Preserve the 1080×1920 output size and existing title locale/region behavior.
- Limit edits to the core profile recap/data path, the two story routes/shared story primitives, relevant service contracts, translations, and focused tests. Existing unrelated worktree changes remain untouched.

## Architecture and data flow

### Shared core summary

The current monthly `summarizeMonth` implementation will become a reusable activity summarizer with an optional date range. Its inputs are:

```ts
summarizeProfileActivity({
  diaryRows,
  movieRatingRows,
  episodeRatingRows,
  watchedSeries,
  monthRange?,
})
```

The helper owns the existing algorithms for:

- diary movie-watch counts and watch-time accumulation;
- episode watch counts and runtime accumulation;
- per-title aggregation and rating averages;
- top-rated movies and series;
- genre consumption ranking;
- highest-rated genre, decade, studio, actor, and actress;
- most-rated genre;
- watched-series metadata and finished-series data;
- deterministic tie-breaking.

Monthly recap construction remains responsible for year/month fields, previous-month comparison, daily activity, active days, and monthly date ranges. Lifetime construction calls the same summary without a date range and uses the existing lightweight lifetime totals for the four canonical lifetime counters.

### Lifetime recap type and query

Add `ProfileLifetimeRecap` in core. It reuses existing title, genre, and rated-category types and contains:

- canonical lifetime totals;
- top-rated movie and series title arrays;
- top genres;
- most-rated genre;
- highest-rated genre, decade, studio, actor, and actress.

The existing title shape gains only the optional metadata required to render lifetime series watch-count pills: `watchedEpisodeCount`, sourced from `WatchedSeries.watched_episode_count`.

`getProfileLifetimeRecapByProfileId(profileId)` runs these five requests in parallel:

1. `getProfileLifetimeStatsByProfileId(profileId)`;
2. unfiltered `watch_diary` rows using the monthly-equivalent title select;
3. non-null `title_ratings` rows using the monthly-equivalent rating select;
4. all `episode_ratings` rows, including null ratings, using the monthly-equivalent episode select;
5. `getWatchedSeries(profileId)` with an empty-array catch fallback.

Query errors follow the profile-stats service convention. The method logs `[profile-stats] lifetime recap failed` with `profileId` and a useful message, then returns an empty `ProfileLifetimeRecap`.

### Web service boundary

Add the optional lifetime recap method to the web profile service interfaces and adapter fallback. Existing consumers of the lightweight lifetime stats method remain unchanged.

## Story presentation

Create a focused shared OG story primitive module used by both routes. It will contain the common versions of:

- top bar and Kino logo sizing;
- header hierarchy;
- watch-time hero and 2×2 summary overview;
- summary stat tiles, including an optional subtitle;
- shared green-bordered featured section/card shell;
- ranked sections, lists, and rows;
- lower content stat tiles;
- footer.

The monthly route will use these primitives with its current content. The lifetime route will be rebuilt around the same structure:

1. recap eyebrow and Kino logo;
2. green period eyebrow `since beginning`;
3. personalized lifetime headline with the user name;
4. large watch-time hero;
5. 2×2 tiles for movies, episodes, ratings, and Kino Time;
6. one shared featured container with movie and series cards;
7. two ranked runner-up lists, with every runner-up starting at rank 2;
8. six lower stat tiles for most-rated genre, highest-rated genre, decade, studio, actor, and actress;
9. shared footer.

The lifetime route removes the old `StatsPills`, independent featured cards, duplicate ratings headings, and rating text formatted as `x / 5`. Ratings move into the shared featured-card pill row. Movie watch-count pills use the lifetime diary-grouped title count. Series pills use `watched_episode_count` and retain the existing service semantics for whether the count is distinct.

Empty titles, missing images, null highlights, and empty ranked arrays render safely through the shared card/list primitives.

## Localization

Add translations for:

- `stats.story.sinceBeginning`;
- `stats.story.lifetimeHeadline` with a `name` interpolation;
- `stats.story.kinoTime`;
- `stats.story.memberSince` with a registered year interpolation;
- pluralized `stats.story.kinoTimeDays`, `kinoTimeMonths`, and `kinoTimeYears`;
- featured-title and watch-count pill copy where the shared monthly phrasing does not already exist.

All supported locales receive the new keys. Kino Time formatting chooses days, months, or years using a locale-independent numeric rule, then delegates wording and pluralization to i18n. The profile query selects `created_at`; the member-since subtitle uses its year.

Lifetime title localization batches every displayed item: featured movie, featured series, movie runners-up, and series runners-up. It uses the same TMDb batch service and `localeRegion(language) ?? 'US'` fallback as the monthly route, updating both titles and poster paths when localized summaries provide them.

## Ranking semantics

Lifetime featured and runner-up items derive from the shared top-rated arrays:

```ts
const featuredMovie = recap.topRatedMovies[0] ?? null
const movieRunnersUp = recap.topRatedMovies.slice(1, 4)
const featuredSeries = recap.topRatedSeries[0] ?? null
const seriesRunnersUp = recap.topRatedSeries.slice(1, 4)
```

Both runner-up lists map ranks as `index + 2`. The monthly series list receives the same correction. The title ID of the featured item cannot also appear in its runner-up list.

## Testing and verification

Core tests will cover:

- shared lifetime aggregation and reuse of monthly ranking semantics;
- null episode-rating rows contributing to episode/watch metadata but not rating calculations;
- repeated diary rows producing repeated movie watches and title counts;
- lifetime series watch-count metadata coming from `WatchedSeries`;
- empty lifetime recap fallback and preserved lightweight stats API behavior.

Web tests will cover:

- lifetime route use of the dedicated recap method and profile `created_at`;
- localized lifetime header/Kino Time/member-since keys across supported locales;
- localization of all displayed ranked title items;
- rank-2 runner-ups and no featured/runner-up duplication;
- removal of `StatsPills`, duplicate ratings headings, and `x / 5` card headers;
- 1080×1920 response dimensions and safe empty rendering.

Verification will run the relevant core/web TypeScript checks, Biome/lint on modified files, focused tests, and local generation/rendering of both monthly and lifetime story images for side-by-side visual inspection.

## Self-review

- No requirement replaces or overloads the lightweight lifetime stats API.
- Lifetime uses the existing monthly rating/highlight definitions rather than introducing another ranking algorithm.
- The lifetime-specific Kino Time metric is represented without language-specific formatter branches.
- All six lower lifetime insight cards remain present and share the same stat-tile visual system.
- The design does not require a database migration.
- The scope excludes unrelated profile/statistics refactors and preserves existing worktree changes.
