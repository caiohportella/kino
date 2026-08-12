# Consistent Rated Contributors in Recaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Kino’s existing monthly and lifetime profile-statistics pipeline so highest-rated people, companies, genres, and decades are selected by weighted quality plus Bayesian confidence over distinct canonical titles.

**Architecture:** Keep all derivation in `packages/core/src/profile-stats.ts`. Build canonical per-title scores from the already fetched rating rows, then feed one shared `calculateRatedHighlights(rows, eligibilityThreshold)` path for lifetime and already month-scoped data. Preserve current most-watched/exposure metrics, public display shapes, database storage, and web localization behavior; only add the monthly highest-rated fields and the episode-key columns needed by the existing lifetime query.

**Tech Stack:** TypeScript, `@kino/core`, Supabase joined rows, Node’s built-in test runner, pnpm, Biome.

## Global Constraints

- The local working tree is the source of truth; do not use GitHub or remote code to infer implementation.
- Reuse existing title metadata, cast, production companies, rating rows, genre IDs, release years, and recap aggregation structures.
- Do not add schema columns, Bayesian persistence, new TMDb requests, or episode-credit ingestion.
- Per-episode cast credits are unavailable locally; use `exposureWeight = 1` for series.
- Use cast billing order weights `1.0`, `0.85`, `0.65`, `0.4`, then `0` for orders `<=1`, `<=4`, `<=9`, `<=14`, and `15+`.
- Use Bayesian confidence `m = 3`, with `n` equal to distinct rated-title count.
- Require 2 distinct rated titles monthly and 3 lifetime for highest-rated people, studios, genres, and decades.
- Keep raw weighted averages as display values; use Bayesian scores only for ordering.
- Keep highest-rated metrics separate from existing most-watched metrics.
- Aggregate by stable IDs, never translated titles or genre names.
- Preserve existing month boundaries, rating semantics, i18n keys, localized-title helpers, and localized genre display.
- Do not overwrite or stage unrelated pre-existing working-tree changes.

---

### Task 1: Define canonical scoped title scores

**Files:**
- Modify: `packages/core/src/profile-stats.ts` near `RatingEventRow`, `calculateProfileRatingStats`, and rating normalization helpers
- Modify: `packages/core/src/database.ts` lifetime rating select and `ProfileRatingJoinRow`
- Test: `packages/core/src/profile-stats.test.mjs`

**Interfaces:**
- Consumes: existing movie and episode rating rows with `title_id`, `rating`, `watched_at`, joined title metadata, and optional `season_number` / `episode_number`.
- Produces: an internal canonical title map keyed by title ID, containing one movie score or one series score, the title metadata needed by later aggregators, and a deterministic observation count.

- [ ] **Step 1: Write failing tests for canonical title scoring behavior**

Add tests to `packages/core/src/profile-stats.test.mjs` that pass real joined rows through `calculateProfileRatingStats` and assert the eventual category outputs will use:

```js
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
    ratedEpisodeRow("series-a", 1, 1, 1),
    ratedEpisodeRow("series-a", 4, 1, 2),
    ratedEpisodeRow("series-b", 4, 1, 1),
    ratedEpisodeRow("series-c", 4, 1, 1),
  ]);

  assert.equal(stats.highestRatedStudio?.titleCount, 3);
});
```

Define these test-only builders before the new cases so every fixture has the same joined-row shape:

```js
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
      production_companies: [
        { id: 1, name: "Test Studio", logo_path: null },
      ],
      release_year: 2000,
      ...metadata,
    },
  };
}

function ratedEpisodeRow(titleId, rating, seasonNumber, episodeNumber, metadata = {}) {
  return {
    title_id: titleId,
    rating,
    watched_at: "2026-08-01T00:00:00.000Z",
    season_number: seasonNumber,
    episode_number: episodeNumber,
    titles: {
      id: titleId,
      title: titleId,
      type: "tv",
      genres: [],
      cast: [],
      production_companies: [
        { id: 1, name: "Test Studio", logo_path: null },
      ],
      release_year: 2000,
      ...metadata,
    },
  };
}

function person(name, order, gender = 2) {
  const id = { Lead: 1, Support: 2, One: 3, Consistent: 4 }[name] ?? 100;
  return { id, name, gender, order, profile_path: null };
}
```

Use these builders only in the test file; they do not change production code.

- [ ] **Step 2: Run the focused tests and verify they fail for the missing canonical behavior**

Run:

```bash
node --test --experimental-strip-types --test-name-pattern "latest movie rating|series once" packages/core/src/profile-stats.test.mjs
```

Expected: FAIL because the current actor, studio, genre, and decade aggregations count raw rating rows instead of one canonical score per title.

- [ ] **Step 3: Fetch episode keys through the existing lifetime query**

Update the existing `episodeRatings` select in `getProfileRatingStatsByProfileId` to include `season_number,episode_number`. Extend `ProfileRatingJoinRow` with optional numeric `season_number` and `episode_number`; do not add another query or table.

- [ ] **Step 4: Implement the internal canonical score builder**

Inside `packages/core/src/profile-stats.ts`, add focused internal types and a helper with this contract:

```ts
type CanonicalRatedTitle = {
  titleId: string;
  rating: number;
  title: JoinedTitleRow;
  observationCount: number;
};

function buildCanonicalRatedTitles(
  rows: RatingEventRow[],
): Map<string, CanonicalRatedTitle>;
```

Implement it with maps:

- For movies, retain the latest valid rating by parsed `watched_at`; use a deterministic rating comparison if timestamps tie.
- For TV rows with episode keys, retain the latest valid rating per `title_id:season_number:episode_number`, then average those episode scores into one series score.
- For TV rows without episode keys, treat the title as one explicit/canonical score and retain its latest valid rating.
- Exclude null, non-finite, and non-positive values.
- Keep `observationCount` separate from the distinct title count so later output can preserve existing event-count fields where required.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run:

```bash
node --test --experimental-strip-types --test-name-pattern "latest movie rating|series once" packages/core/src/profile-stats.test.mjs
```

Expected: PASS, with the tests proving movie rewatches and repeated episode rows no longer inflate the canonical title sample.

- [ ] **Step 6: Commit only the canonical-score changes**

```bash
git add packages/core/src/profile-stats.ts packages/core/src/database.ts packages/core/src/profile-stats.test.mjs
git commit -m "feat: canonicalize profile rating title scores"
```

### Task 2: Add shared confidence-aware category ranking

**Files:**
- Modify: `packages/core/src/profile-stats.ts` near the existing genre, studio, actor, and decade aggregation code
- Test: `packages/core/src/profile-stats.test.mjs`

**Interfaces:**
- Consumes: `Map<string, CanonicalRatedTitle>` from Task 1, title cast/genre/company/release-year metadata, and a scope threshold.
- Produces: existing `ProfileRatedCategoryStat` / `ProfileRatedDecadeStat` result shapes with raw averages and deterministic winners; internal Bayesian scores remain private.

- [ ] **Step 1: Write failing tests for prominence, Bayesian confidence, genre, decade, and ties**

Add focused tests that encode the required behavior:

```js
test("billing order weights supporting and minor cast roles", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("lead-a", 5, "2026-01-01T00:00:00.000Z", {
      cast: [{ id: 1, name: "Lead", gender: 2, order: 0, profile_path: null }],
    }),
    ratedMovieRow("lead-b", 5, "2026-01-02T00:00:00.000Z", {
      cast: [{ id: 1, name: "Lead", gender: 2, order: 0, profile_path: null }],
    }),
    ratedMovieRow("support-a", 4, "2026-01-03T00:00:00.000Z", {
      cast: [{ id: 2, name: "Support", gender: 2, order: 5, profile_path: null }],
    }),
    ratedMovieRow("support-b", 4, "2026-01-04T00:00:00.000Z", {
      cast: [{ id: 2, name: "Support", gender: 2, order: 5, profile_path: null }],
    }),
  ]);

  assert.equal(stats.highestRatedActor?.name, "Lead");
});

test("repeated strong candidate beats a one-title perfect candidate after Bayesian confidence", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("one", 5, "2026-01-01T00:00:00.000Z", { cast: [person("One", 10)] }),
    ...["two", "three", "four", "five", "six", "seven"].map((id, index) =>
      ratedMovieRow(id, 4.8, `2026-01-${String(index + 2).padStart(2, "0")}T00:00:00.000Z`, {
        cast: [person("Consistent", 10)],
      }),
  ]);

  assert.equal(stats.highestRatedActor?.name, "Consistent");
});

test("highest-rated genre and decade use distinct-title Bayesian eligibility", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("a", 5, "2026-01-01T00:00:00.000Z", { genres: [{ id: 1, name: "Drama" }], release_year: 1999 }),
    ratedMovieRow("b", 4.5, "2026-01-02T00:00:00.000Z", { genres: [{ id: 1, name: "Drama" }], release_year: 1998 }),
    ratedMovieRow("c", 4.5, "2026-01-03T00:00:00.000Z", { genres: [{ id: 1, name: "Drama" }], release_year: 2000 }),
    ratedMovieRow("d", 4.5, "2026-01-04T00:00:00.000Z", { genres: [{ id: 1, name: "Drama" }], release_year: 1997 }),
  ]);

  assert.equal(stats.highestRatedGenre?.id, 1);
  assert.equal(stats.highestRatedDecade?.startYear, 1990);
});

test("highest-rated category results use stable ID tie-breaking", () => {
  const stats = calculateProfileRatingStats([
    ratedMovieRow("a", 4, "2026-01-01T00:00:00.000Z", { genres: [{ id: 2, name: "B" }] }),
    ratedMovieRow("b", 4, "2026-01-02T00:00:00.000Z", { genres: [{ id: 1, name: "A" }] }),
    ratedMovieRow("c", 4, "2026-01-03T00:00:00.000Z", { genres: [{ id: 2, name: "B" }] }),
    ratedMovieRow("d", 4, "2026-01-04T00:00:00.000Z", { genres: [{ id: 1, name: "A" }] }),
    ratedMovieRow("e", 4, "2026-01-05T00:00:00.000Z", { genres: [{ id: 1, name: "A" }] }),
    ratedMovieRow("f", 4, "2026-01-06T00:00:00.000Z", { genres: [{ id: 2, name: "B" }] }),
  ]);

  assert.equal(stats.highestRatedGenre?.id, 1);
});
```

Also cover missing gender, order `10–14` contributing at `0.40`, order `15+` being ignored, equal company weights, one-off studio exclusion, and null output below the threshold.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test --experimental-strip-types --test-name-pattern "billing order|Bayesian|genre|decade|tie" packages/core/src/profile-stats.test.mjs
```

Expected: FAIL because current aggregation uses raw averages, ignores cast order, and allows one-title categories.

- [ ] **Step 3: Implement the private weighting and Bayesian helpers**

Add these private helpers in `profile-stats.ts`:

```ts
const BAYESIAN_CONFIDENCE_THRESHOLD = 3;

function getCastProminenceWeight(order: number | undefined): number;

function getBayesianRankingScore(
  rawAverage: number,
  distinctTitleCount: number,
  scopeAverage: number,
): number;
```

`getCastProminenceWeight(undefined)` must return `0` so missing billing order never invents lead status. `getBayesianRankingScore` must implement `(n / (n + 3)) * R + (3 / (n + 3)) * C`.

- [ ] **Step 4: Implement shared candidate accumulation and deterministic ranking**

Use internal maps keyed by stable IDs:

- Person map stores name, ID, raw weighted total, weight total, distinct title IDs, and observation count. For each title/person pair, contribution weight is cast prominence times `1` series exposure fallback. Skip person IDs without gender classification and cast order `15+`.
- Studio map stores raw total, distinct title IDs, observation count, and metadata. Every company on a title contributes equally with weight `1`; never use array order as prominence.
- Genre map stores raw total, distinct title IDs, and name only for display fallback. Every genre on a title contributes once with weight `1`.
- Decade map stores raw total and distinct title IDs; ignore missing or invalid release years.

Rank only candidates meeting the scope threshold. Use Bayesian score over raw weighted average for people, companies, genres, and decades. Emit the existing raw `average`, `count`, and `titleCount` fields without adding `rankingScore` to public types. Sort with ranking score, title count, raw average, observation count, stable numeric ID, and finally name. Keep most-rated genre on its separate distinct-title-count ordering.

Expose the shared result through this internal contract so monthly integration does not duplicate aggregation:

```ts
function calculateRatedHighlights(
  rows: RatingEventRow[],
  eligibilityThreshold: number,
): {
  highestRatedStudio: ProfileRatedCategoryStat | null;
  highestRatedActor: ProfileRatedCategoryStat | null;
  highestRatedActress: ProfileRatedCategoryStat | null;
  highestRatedGenre: ProfileRatedCategoryStat | null;
  highestRatedDecade: ProfileRatedDecadeStat | null;
};
```

- [ ] **Step 5: Replace lifetime category winner selection with the shared ranking path**

Within `calculateProfileRatingStats`, preserve existing distribution, overall averages, title extrema, and most-rated behavior, but derive `highestRatedStudio`, `highestRatedActor`, `highestRatedActress`, `highestRatedGenre`, and `highestRatedDecade` from canonical titles and shared ranking. Keep `mostRatedGenre` ranked by distinct title count, then raw average, then stable genre ID.

- [ ] **Step 6: Run the core profile-statistics tests**

Run:

```bash
pnpm --filter @kino/core test
```

Expected: PASS, including the existing distinct-count, company fallback, gender, genre, decade, and extrema tests updated only where the intended confidence semantics change.

- [ ] **Step 7: Commit only the shared ranking changes**

```bash
git add packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs
git commit -m "feat: rank rated profile categories with confidence"
```

### Task 3: Integrate monthly highest-rated statistics

**Files:**
- Modify: `packages/core/src/types.ts` `ProfileMonthlyRecap`
- Modify: `packages/core/src/profile-stats.ts` `MonthlySummary`, `summarizeMonth`, and `buildProfileMonthlyRecap`
- Modify: `packages/core/src/database.ts` monthly fallback object
- Test: `packages/core/src/profile-stats.test.mjs`

**Interfaces:**
- Consumes: current-month rating rows already bounded by `createMonthRange`, the canonical title builder, and shared ranking helpers from Tasks 1–2.
- Produces: `ProfileMonthlyRecap.highestRatedStudio`, `.highestRatedActor`, `.highestRatedActress`, `.highestRatedGenre`, and `.highestRatedDecade`; existing `mostWatchedStudio`, `topActor`, `topGenres`, and month boundaries remain unchanged.

- [ ] **Step 1: Write failing monthly scope and separation tests**

Add tests such as:

```js
test("monthly highest-rated categories use only current-month rating rows", () => {
  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [],
      movieRatingRows: [
        ratedMovieRow("aug-a", 5, "2026-08-02T00:00:00.000Z", { genres: [{ id: 1, name: "Drama" }] }),
        ratedMovieRow("aug-b", 4.5, "2026-08-03T00:00:00.000Z", { genres: [{ id: 1, name: "Drama" }] }),
      ],
      episodeRatingRows: [],
    },
    previous: { diaryRows: [], movieRatingRows: [], episodeRatingRows: [] },
  });

  assert.equal(recap.highestRatedGenre?.id, 1);
  assert.equal(recap.highestRatedGenre?.titleCount, 2);
  assert.equal(recap.highestRatedActor, null);
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
```

Use the existing test row shapes, keep every current rating row inside the already supplied month, and assert that the helper does not add a second date filter.

- [ ] **Step 2: Run the monthly tests and verify they fail**

Run:

```bash
node --test --experimental-strip-types --test-name-pattern "monthly highest-rated|most-watched exposure" packages/core/src/profile-stats.test.mjs
```

Expected: FAIL because the monthly recap type and summary currently expose only most-watched studio/actor values.

- [ ] **Step 3: Extend the monthly recap type with raw display shapes**

In `packages/core/src/types.ts`, add these nullable fields to `ProfileMonthlyRecap`:

```ts
highestRatedStudio: ProfileRatedCategoryStat | null;
highestRatedActor: ProfileRatedCategoryStat | null;
highestRatedActress: ProfileRatedCategoryStat | null;
highestRatedGenre: ProfileRatedCategoryStat | null;
highestRatedDecade: ProfileRatedDecadeStat | null;
```

Do not add Bayesian scores or localized title strings to the type.

- [ ] **Step 4: Feed month-scoped rating rows into shared ranking**

In `summarizeMonth`, retain the existing watch/activity maps for exposure metrics. Add a `ratingHighlights` result by calling `calculateRatedHighlights([...movieRatingRows, ...episodeRatingRows], 2)`, which uses only rows already supplied by the database method for the requested month. Return the five new fields from `buildProfileMonthlyRecap`.

Do not use `diaryRows` to create rating contributions, do not use lifetime rows, and do not change `createMonthRange` or the existing `topGenres` activity calculation.

- [ ] **Step 5: Update the monthly database fallback object and run tests**

Add null values for all five new fields in the monthly error fallback, then run:

```bash
pnpm --filter @kino/core test
pnpm --filter @kino/core typecheck
```

Expected: PASS with existing most-watched and monthly comparison tests unchanged.

- [ ] **Step 6: Commit only monthly integration changes**

```bash
git add packages/core/src/types.ts packages/core/src/profile-stats.ts packages/core/src/database.ts packages/core/src/profile-stats.test.mjs
git commit -m "feat: add scoped monthly rated category stats"
```

### Task 4: Preserve localization and verify the complete workspace checks

**Files:**
- Modify: none expected; only touch `apps/web/components/profile/profile-stats-page.tsx`, `apps/web/lib/profile-stats-localization.test.mjs`, or existing localized genre helpers if a test failure is directly caused by the new statistic shape
- Test: existing web localization tests and core profile-statistics tests

**Interfaces:**
- Consumes: stable-ID core statistic outputs and existing web localization helpers.
- Produces: verified localized display behavior with no new translation keys or raw-title rendering in ranking code.

- [ ] **Step 1: Verify the existing localization regression assertions before changing UI code**

Confirm the existing tests still assert that:

```js
assert.equal(statsPage.includes("useLocalizedTitles("), true);
assert.equal(statsPage.includes("localizedTitleKey("), true);
assert.equal(statsCard.includes("getLocalizedGenreName(stats.highestRatedGenre, t)"), true);
```

The current assertions cover these paths, so run them as-is and do not create duplicate tests. No production localization code should be added for this metric.

- [ ] **Step 2: Run focused localization and core tests**

Run:

```bash
pnpm --filter @kino/core test
node --test --experimental-strip-types apps/web/lib/profile-stats-localization.test.mjs
```

Expected: PASS, with title display continuing through `useLocalizedTitles` and genre display continuing through stable genre-ID localization.

- [ ] **Step 3: Run formatting, lint, typecheck, and the broader tests**

Run the scripts defined by the repository root:

```bash
pnpm biome check packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs packages/core/src/types.ts packages/core/src/database.ts
pnpm lint
pnpm typecheck
pnpm test
```

Expected: exit code `0` for each command. Fix only failures caused by the recap-statistics changes; do not clean up unrelated dirty-tree changes.

- [ ] **Step 4: Inspect the final diff and confirm scope**

Run:

```bash
git diff --check
git status --short
git diff --stat -- packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs packages/core/src/types.ts packages/core/src/database.ts apps/web/lib/profile-stats-localization.test.mjs apps/web/components/profile/profile-stats-page.tsx
```

Confirm that the implementation does not add migrations, TMDb calls, translated-title aggregation, or changes to unrelated existing user edits.

- [ ] **Step 5: Commit only verified implementation files**

```bash
git add packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs packages/core/src/types.ts packages/core/src/database.ts
git commit -m "feat: improve confidence-aware recap statistics"
```
