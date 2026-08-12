# Monthly Watch Calendar and Comparison Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monthly recap activity heatmap with a localized full-month watch calendar and add semantic color/icon cues to the existing previous-month comparison card.

**Architecture:** Enrich the existing core `dailyActivity` map with movie and episode counts, then expose those additive fields through the existing monthly recap contract. Add a pure web calendar-model helper for month cells and derived summaries, render it in a focused monthly calendar component, and keep the lifetime heatmap and server comparison calculations unchanged.

**Tech Stack:** TypeScript, React/Next.js, Tailwind CSS, lucide-react, Node test runner, existing Kino i18n and profile statistics helpers.

## Global Constraints

- The local working tree is authoritative; preserve all unrelated uncommitted work.
- Do not add queries, calendar libraries, or a second raw activity traversal.
- Reuse the existing local-date aggregation, runtime fields, green heatmap palette, duration formatter, month/date helpers, and translation infrastructure.
- Calendar biggest-binge ranking is episode count, then total minutes, then earliest date.
- Calendar most-active ranking is total minutes, then earliest date.
- Keep lifetime activity heatmap behavior unchanged.
- Keep existing monthly comparison calculations and metrics unchanged.
- Add translation keys for every supported locale: `en`, `fr`, `it`, `no`, and `pt`.

---

### Task 1: Extend the existing monthly daily aggregation

**Files:**
- Modify: `packages/core/src/types.ts:578-583`
- Modify: `packages/core/src/profile-stats.ts:1068-1298`
- Test: `packages/core/src/profile-stats.test.mjs` near the existing monthly recap tests

**Interfaces:**
- Consumes: existing `WatchEventRow`, `RatingEventRow`, `summarizeMonth`, `buildProfileMonthlyRecap`, and `toLocalDateKey`.
- Produces: `ProfileMonthlyRecapActivityDay` values with `moviesWatched` and `episodesWatched`; unchanged monthly totals and comparison fields.

- [ ] **Step 1: Write failing core aggregation tests.**

Add tests that call `buildProfileMonthlyRecap` with existing row shapes and assert the returned `dailyActivity` entries:

```js
test("aggregates movie and episode counts and runtime on the same local day", () => {
  const recap = buildProfileMonthlyRecap({
    year: 2026,
    month: 8,
    current: {
      diaryRows: [
        {
          title_id: "movie-a",
          watched_at: "2026-08-15T10:00:00.000Z",
          watch_type: "first-time",
          titles: {
            id: "movie-a",
            title: "Movie A",
            type: "movie",
            runtime: 120,
          },
        },
      ],
      movieRatingRows: [],
      episodeRatingRows: [
        {
          title_id: "series-a",
          watched_at: "2026-08-15T12:00:00.000Z",
          runtime_minutes: 45,
          watch_type: "first-time",
          titles: { id: "series-a", title: "Series A", type: "tv" },
        },
        {
          title_id: "series-a",
          watched_at: "2026-08-15T13:00:00.000Z",
          runtime_minutes: 50,
          watch_type: "rewatch",
          titles: { id: "series-a", title: "Series A", type: "tv" },
        },
      ],
    },
    previous: { diaryRows: [], movieRatingRows: [], episodeRatingRows: [] },
  });

  assert.deepEqual(recap.dailyActivity, [
    {
      date: "2026-08-15",
      entries: 3,
      moviesWatched: 1,
      episodesWatched: 2,
      minutes: 215,
    },
  ]);
  assert.equal(recap.activeDays, 1);
  assert.equal(recap.moviesWatched, 1);
  assert.equal(recap.episodesWatched, 2);
  assert.equal(recap.timeWatchedMinutes, 215);
});
```

Add a second test with two active days whose episode counts tie but minutes differ, and a third earlier day with the same count and minutes, so the shared daily data can later prove the required binge tie order without changing core totals.

- [ ] **Step 2: Run the focused tests and verify the expected failure.**

Run:

```powershell
node --test --experimental-strip-types packages/core/src/profile-stats.test.mjs --test-name-pattern "aggregates movie and episode counts|binge tie"
```

Expected: the new assertions fail because the activity entries do not yet expose separate movie and episode counts.

- [ ] **Step 3: Add the additive type fields.**

Update `ProfileMonthlyRecapActivityDay` in `packages/core/src/types.ts` with:

```ts
moviesWatched: number
episodesWatched: number
```

Do not rename or remove `entries` or `minutes`.

- [ ] **Step 4: Update the single existing `dailyActivity` map.**

Initialize each activity entry in `summarizeMonth` as:

```ts
{ entries: 0, moviesWatched: 0, episodesWatched: 0, minutes: 0 }
```

In the movie branch, increment `moviesWatched` alongside `entries`. In the episode branch, increment `episodesWatched` alongside `entries`. Keep the current runtime sources and month checks exactly as they are.

Map the two new fields in `buildProfileMonthlyRecap` when converting the map to `ProfileMonthlyRecapActivityDay[]`.

- [ ] **Step 5: Run the focused tests and the full core profile-stat tests.**

Run:

```powershell
node --test --experimental-strip-types packages/core/src/profile-stats.test.mjs --test-name-pattern "aggregates movie and episode counts|binge tie"
node --test --experimental-strip-types packages/core/src/profile-stats.test.mjs
```

Expected: both commands pass, with existing monthly totals and comparison tests unchanged.

---

### Task 2: Build a pure monthly calendar model

**Files:**
- Create: `apps/web/lib/monthly-watch-calendar.ts`
- Create: `apps/web/lib/monthly-watch-calendar.test.mjs`

**Interfaces:**
- Consumes: `ProfileMonthlyRecapActivityDay` and the selected `year`, `month`.
- Produces: deterministic seven-column cells and derived summary values for the React component.

- [ ] **Step 1: Write failing helper tests.**

Create tests for the exported functions:

```ts
export type MonthlyCalendarModel = {
  weeks: MonthlyCalendarCell[][]
  activeDays: number
  longestStreak: number
  mostActiveDay: ProfileMonthlyRecapActivityDay | null
  biggestBingeDay: ProfileMonthlyRecapActivityDay | null
  maxMinutes: number
}

export function buildMonthlyWatchCalendar(input: {
  year: number
  month: number
  dailyActivity: ProfileMonthlyRecapActivityDay[]
  weekStartsOn?: 0 | 1
}): MonthlyCalendarModel
```

The tests must assert:

- August 2026 begins on Saturday with five leading Monday-first slots and September is never represented as active data.
- February 2024 has 29 real days and month positioning remains correct when the month begins mid-week and ends mid-week.
- active days and longest consecutive-day streak are derived from one activity map.
- most active day chooses greatest minutes, then earliest date on a minute tie.
- biggest binge chooses greatest episode count, then greatest minutes, then earliest date.
- zero-activity and outside-month cells are inactive with no activity object.
- date-only keys remain stable without `new Date(date).getDate()` timezone shifts.
- intensity produces five monthly-relative levels, with zero at level 0 and the highest positive-minute day at the top level.

- [ ] **Step 2: Run the helper tests and verify they fail because the module is missing.**

Run:

```powershell
node --test --experimental-strip-types apps/web/lib/monthly-watch-calendar.test.mjs
```

Expected: module-resolution failure for `monthly-watch-calendar.ts`.

- [ ] **Step 3: Implement date-safe grid generation and derived summaries.**

Implement `buildMonthlyWatchCalendar` using date-only keys and UTC construction for month arithmetic. Default `weekStartsOn` to `1`, matching Kino's existing heatmap because the local codebase has no separate locale first-day helper. Generate complete weeks from the first day through the last day, and create outside-month cells with `activity: null`.

Use one `Map<string, ProfileMonthlyRecapActivityDay>` for all derived values. Sort valid activity dates ascending for streaks and tie-breaking. Define active as `moviesWatched > 0 || episodesWatched > 0`.

Implement monthly-relative intensity by ranking positive minute values into the existing five-level scale (`0..4`) with deterministic percentile buckets. Keep inactive and zero-minute days at level 0. Return `maxMinutes` for the component's legend/cell styling.

- [ ] **Step 4: Run the helper tests and verify they pass.**

Run:

```powershell
node --test --experimental-strip-types apps/web/lib/monthly-watch-calendar.test.mjs
```

Expected: all helper tests pass.

---

### Task 3: Render the monthly watch calendar

**Files:**
- Create: `apps/web/components/profile/monthly-watch-calendar.tsx`
- Modify: `apps/web/components/profile/profile-monthly-recap-page.tsx`
- Modify: `apps/web/lib/profile-activity-heatmap.test.mjs`

**Interfaces:**
- Consumes: `ProfileMonthlyRecap.dailyActivity`, `buildMonthlyWatchCalendar`, `formatWatchTimeCompact`, `formatWatchTimeAccessible`, `formatProfileMonth`, `useTranslation`, and the existing `PROFILE_ACTIVITY_LEVEL_COLORS` palette.
- Produces: a localized seven-column watch calendar with legend, tooltips, accessible labels, and summary row.

- [ ] **Step 1: Add source-level regression expectations before changing the page.**

Update the existing monthly heatmap assertion so it expects `MonthlyWatchCalendar` and no longer expects the monthly page to render `HeatmapCalendar`. Keep the lifetime heatmap assertions unchanged. Add focused source assertions for:

- seven-column grid and `role="grid"`/`role="gridcell"`
- `buildMonthlyWatchCalendar`
- `PROFILE_ACTIVITY_LEVEL_COLORS`
- localized weekday/date formatting
- keyboard-focusable active cells
- accessible most-active indicator
- `formatWatchTimeCompact` and existing less/more legend labels

Run:

```powershell
node --test --experimental-strip-types apps/web/lib/profile-activity-heatmap.test.mjs --test-name-pattern "monthly|calendar"
```

Expected: the updated monthly assertions fail before the component/page changes.

- [ ] **Step 2: Implement the component structure.**

Render:

- localized heading using `stats.watchCalendar`
- localized description using the selected month label
- weekday header from `Intl.DateTimeFormat(locale, { weekday: 'short' })` with Monday-first order
- weeks/cells from the pure model
- day number, compact movie label, compact episode label, and duration
- existing green palette, neutral inactive cells, and a five-swatch less/more legend
- summary items for longest streak, most active day, active days, and biggest binge day

Use `role="grid"`, `role="row"`, and `role="gridcell"`. Active cells should use `tabIndex={0}` and an `aria-label` assembled from localized counts and `formatWatchTimeAccessible`. Use a tooltip trigger that remains focusable and includes the same details. Mark the most active cell with an accent ring/icon and visually hidden explanatory text.

Use responsive Tailwind classes so desktop cells show count and duration, while mobile uses compact labels and keeps each cell usable without horizontal overflow.

- [ ] **Step 3: Replace only the monthly page activity section.**

In `profile-monthly-recap-page.tsx`, replace the `HeatmapCalendar` import and render block with `MonthlyWatchCalendar`, passing `year`, `month`, `dailyActivity`, and locale/translation context. Keep the surrounding card, all other recap cards, query hook, totals, and lifetime page untouched.

- [ ] **Step 4: Add missing translation keys for all supported locales.**

Add the following keys under each locale's `stats` object, using the locale's existing style and terminology:

```json
{
  "watchCalendar": "Watch calendar",
  "watchCalendarDescription": "Every day in {{month}}, at a glance",
  "longestStreak": "Longest streak",
  "mostActiveDay": "Most active day",
  "biggestBingeDay": "Biggest binge day",
  "mostActiveDayIndicator": "Most active day by watch time",
  "calendarDayLabel": "{{date}}: {{movies}} movies, {{episodes}} episodes, {{duration}} watched",
  "noEpisodes": "No episodes"
}
```

Use existing `stats.movies`, `stats.episodesShort`, `stats.duration.*`, and pluralization conventions where possible; only the calendar-specific labels above should be new. Ensure all five locale files contain every key.

- [ ] **Step 5: Run the calendar tests and relevant localization tests.**

Run:

```powershell
node --test --experimental-strip-types apps/web/lib/monthly-watch-calendar.test.mjs
node --test --experimental-strip-types apps/web/lib/profile-activity-heatmap.test.mjs
node --test --experimental-strip-types apps/web/lib/profile-stats-localization.test.mjs
```

Expected: all pass, and lifetime heatmap expectations remain green.

---

### Task 4: Add semantic previous-month comparison cues

**Files:**
- Modify: `apps/web/components/profile/profile-monthly-recap-page.tsx:75-101`
- Modify: `apps/web/components/profile/previous-month-card.tsx`
- Create: `apps/web/lib/monthly-comparison.ts`
- Create: `apps/web/lib/monthly-comparison.test.mjs`

**Interfaces:**
- Consumes: existing numeric `ProfileMonthlyRecapComparison` deltas and `formatWatchTimeDelta`.
- Produces: unchanged comparison metrics with typed direction, icon, and semantic color.

- [ ] **Step 1: Add failing presentation tests.**

Add pure helper assertions for the three directions:

```ts
export type ComparisonTone = "positive" | "negative" | "neutral"

export function getComparisonTone(delta: number): ComparisonTone

getComparisonTone(6)  // "positive"
getComparisonTone(-8) // "negative"
getComparisonTone(0)  // "neutral"
```

Also keep the existing page source assertion that duration values call `formatWatchTimeCompact` through the current delta formatter and that all four existing rows remain present.

Run `node --test --experimental-strip-types apps/web/lib/monthly-comparison.test.mjs` and verify it fails because the helper module is missing.

- [ ] **Step 2: Preserve numeric deltas when constructing page rows.**

Implement `getComparisonTone(delta)` as a sign-only helper returning `"positive"`, `"negative"`, or `"neutral"`. Extend `PreviousMonthComparisonRow` with `delta: number`. Keep `value` as the already localized display string. Pass the corresponding existing delta for time, movies, episodes, and ratings from the page; do not recompute any previous-month totals.

- [ ] **Step 3: Render direction icon and semantic color.**

In `previous-month-card.tsx`, import `ArrowDown`, `ArrowUp`, and `Minus` from `lucide-react`, and import `getComparisonTone` from `@/lib/monthly-comparison`. Select the icon from the returned tone, render it with `aria-hidden="true"` beside the value, and apply:

- `text-kino-accent` for positive
- the existing restrained muted/down token for negative
- `text-kino-muted` for zero

Keep separators, spacing, heading, empty state, and metrics unchanged.

- [ ] **Step 4: Run comparison and recap tests.**

Run:

```powershell
node --test --experimental-strip-types apps/web/lib/monthly-comparison.test.mjs
node --test --experimental-strip-types packages/core/src/profile-stats.test.mjs --test-name-pattern "monthly recap|comparison"
```

Expected: positive, negative, and zero deltas render correctly without changing core comparison values.

---

### Task 5: Verify the integrated change

**Files:**
- No new files; inspect all files changed by Tasks 1-4.

- [ ] **Step 1: Run focused behavioral checks.**

```powershell
node --test --experimental-strip-types packages/core/src/profile-stats.test.mjs
node --test --experimental-strip-types apps/web/lib/monthly-watch-calendar.test.mjs
node --test --experimental-strip-types apps/web/lib/monthly-comparison.test.mjs
node --test --experimental-strip-types apps/web/lib/profile-activity-heatmap.test.mjs
node --test --experimental-strip-types apps/web/lib/profile-stats-localization.test.mjs
```

- [ ] **Step 2: Run package typechecks.**

```powershell
pnpm --filter @kino/core typecheck
pnpm --filter @kino/web typecheck
```

- [ ] **Step 3: Run package lint and inspect only touched-file diagnostics.**

```powershell
pnpm --filter @kino/web lint
pnpm exec biome check packages/core/src/types.ts packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs apps/web/components/profile/monthly-watch-calendar.tsx apps/web/components/profile/profile-monthly-recap-page.tsx apps/web/components/profile/previous-month-card.tsx apps/web/lib/monthly-watch-calendar.ts apps/web/lib/monthly-watch-calendar.test.mjs apps/web/lib/monthly-comparison.ts apps/web/lib/monthly-comparison.test.mjs
```

Do not apply repository-wide formatting or modify unrelated dirty files.

- [ ] **Step 4: Inspect the final diff and status.**

```powershell
git diff --check -- packages/core/src/types.ts packages/core/src/profile-stats.ts apps/web/components/profile/monthly-watch-calendar.tsx apps/web/components/profile/profile-monthly-recap-page.tsx apps/web/components/profile/previous-month-card.tsx apps/web/lib/monthly-watch-calendar.ts apps/web/lib/monthly-comparison.ts
git status --short
```

Confirm no unrelated files were staged or modified by this work.

- [ ] **Step 5: Keep the implementation uncommitted unless the user explicitly requests integration.**

The approved design spec is already committed. Preserve the existing dirty worktree and report any unrelated baseline test failures separately.
