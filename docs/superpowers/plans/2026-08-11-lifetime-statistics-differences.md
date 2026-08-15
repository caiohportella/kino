# Lifetime Statistics Mockup Differences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Lifetime Statistics analytics and cards to match the updated ratings and Movies × Series mockup differences with localized Recharts visualizations and deterministic tests.

**Architecture:** Reuse the existing core rating and viewing-breakdown datasets and query boundaries. Add typed derived analytics in `packages/core`, pass those results through existing query fallbacks, and keep all locale formatting and presentation in the profile cards. Replace only the two existing CSS composition-bar implementations with one small reusable Recharts component.

**Tech Stack:** TypeScript, React/Next.js, Recharts, Base UI/shadcn chart primitives, Node test runner, pnpm workspace.

## Global Constraints

- Do not add parallel lifetime-statistics queries, duplicate analytics calculations, duplicate hooks, duplicate TMDB requests, or new API fields.
- Preserve the current Kino theme, Base UI components, responsive behavior, shared profile/settings components, page ordering, heatmap, highs/lows, milestones, hero/header, Monthly Recap behavior, and episode-runtime work.
- Keep analytics numeric/structured and deterministic; keep localization, formatting, tooltips, and presentation strings in web components.
- Use user movie ratings and user episode ratings only; never use TMDB ratings for the new averages.
- Use movie diary events and episode watch-history/rating events for media splits, preserving existing rewatch semantics and UTC calendar handling.
- Keep all ten half-star buckets: `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `3.5`, `4`, `4.5`, `5`.
- Ensure `en`, `pt`, `fr`, `it`, and `no` translation resources contain every new visible key and plural variant.

---

### Task 1: Add rating analytics for media averages and most-rated genre

**Files:**
- Modify: `packages/core/src/types.ts:501-515`
- Modify: `packages/core/src/profile-stats.ts:95-410`
- Modify: `packages/core/src/database.ts:1117-1131`
- Modify: `apps/web/lib/profile-query-options.ts:354-380`
- Modify: `apps/web/lib/profile-query-service.ts:192-213`
- Test: `packages/core/src/profile-stats.test.mjs`

**Interfaces:**
- Produces `ProfileRatingStats.movieAverageRating: number | null`.
- Produces `ProfileRatingStats.seriesAverageRating: number | null`.
- Produces `ProfileRatingStats.mostRatedGenre: ProfileRatedCategoryStat | null`.
- Keeps `averageRating`, `fiveStarRate`, existing highest-rated stats, and title extrema unchanged.

- [ ] **Step 1: Write failing core tests for media averages.**

Add a `calculateProfileRatingStats` fixture with movie and TV title rows, including multiple TV episode ratings, and assert that `movieAverageRating` averages only movie rating rows and `seriesAverageRating` averages only TV episode rating rows. Include an empty-input assertion that both fields are `null`.

- [ ] **Step 2: Run the focused test and verify the expected failure.**

Run: `pnpm --filter @kino/core test -- --test-name-pattern="media averages"`

Expected: FAIL because the new result fields do not exist yet.

- [ ] **Step 3: Write a failing core test for count-ranked genre.**

Add ratings where one genre has a higher average but fewer rating associations and another genre has more rating associations. Assert `highestRatedGenre` selects by existing average semantics and `mostRatedGenre` selects the larger count, with the expected count and name.

- [ ] **Step 4: Run the genre test and verify the expected failure.**

Run: `pnpm --filter @kino/core test -- --test-name-pattern="most-rated genre"`

Expected: FAIL because `mostRatedGenre` is not part of the result.

- [ ] **Step 5: Implement the minimal typed analytics extension.**

While iterating the existing normalized rating rows in `calculateProfileRatingStats`, accumulate movie and TV totals/counts from the joined title type. Derive rounded averages using the existing `roundRating` helper. Derive `mostRatedGenre` from the existing `genreRatings` map sorted by `count` descending, then average descending, then localized-independent name ascending. Add the fields to the return object and every empty fallback object in the core/web query adapters.

- [ ] **Step 6: Run the focused core tests and verify they pass.**

Run: `pnpm --filter @kino/core test -- --test-name-pattern="media averages|most-rated genre"`

Expected: PASS with no unrelated failures.

- [ ] **Step 7: Commit the analytics change.**

```bash
git add packages/core/src/types.ts packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs
git commit -m "feat: add lifetime rating media insights"
```

### Task 2: Add deterministic weekday/weekend media splits

**Files:**
- Modify: `packages/core/src/types.ts:530-539`
- Modify: `packages/core/src/profile-stats.ts:455-530`
- Modify: `packages/core/src/database.ts:896-905,1117-1131`
- Modify: `apps/web/lib/profile-query-options.ts:329-350`
- Modify: `apps/web/lib/profile-query-service.ts:192-213`
- Test: `packages/core/src/profile-stats.test.mjs`

**Interfaces:**
- Produces `ProfileMediaSplit` with `movies`, `series`, `moviePercentage`, `seriesPercentage`, and `dominantType: "movie" | "series" | null`.
- Produces `ProfileViewingBreakdownStats.weekdayMediaSplit` and `.weekendMediaSplit`.
- `calculateProfileViewingBreakdownStats` continues to accept the existing `{ diaryRows, episodeRows }` input without a new query input.

- [ ] **Step 1: Write failing tests for weekday and weekend event semantics.**

Add movie diary rows and TV episode rows at UTC dates spanning Monday–Friday and Saturday–Sunday. Assert movie/series counts, percentages, and dominant type for each bucket. Include repeated episode events to prove series activity is episode-event based and include rewatch movie events to prove existing event semantics are retained.

- [ ] **Step 2: Write a failing zero-data test.**

Call `calculateProfileViewingBreakdownStats({ diaryRows: [], episodeRows: [] })` and assert both splits have zero counts, zero percentages, and `dominantType: null`.

- [ ] **Step 3: Run the focused tests and verify the expected failure.**

Run: `pnpm --filter @kino/core test -- --test-name-pattern="media split|zero-data"`

Expected: FAIL because the split fields do not exist.

- [ ] **Step 4: Implement the minimal split helper.**

Add a private helper that receives valid movie and episode rows, classifies `new Date(watched_at).getUTCDay()` as weekday (`1`–`5`) or weekend (`0`, `6`), increments one event per valid movie/episode row, calculates percentages from the bucket total, and returns `null` dominance for ties or empty data. Invoke it from `calculateProfileViewingBreakdownStats` after the existing runtime/streak calculations.

- [ ] **Step 5: Update all typed empty fallbacks.**

Add zero-value `weekdayMediaSplit` and `weekendMediaSplit` objects to the database service fallback, query-options fallback, and query-service fallback so every consumer remains type-safe.

- [ ] **Step 6: Run the focused and existing viewing tests.**

Run: `pnpm --filter @kino/core test -- --test-name-pattern="media split|viewing breakdown"`

Expected: PASS, including existing runtime/streak assertions.

- [ ] **Step 7: Commit the media split change.**

```bash
git add packages/core/src/types.ts packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs packages/core/src/database.ts apps/web/lib/profile-query-options.ts apps/web/lib/profile-query-service.ts
git commit -m "feat: add lifetime weekday weekend media splits"
```

### Task 3: Make Lifetime decade shares real composition percentages

**Files:**
- Modify: `apps/web/components/profile/profile-stats-page.tsx:488-670`
- Test: `apps/web/lib/profile-watching-habits-card.test.mjs`

**Interfaces:**
- Keeps `analytics.decades` as the existing ordered `{ label, count, percentage }[]` input to `ProfileWatchingHabitsCard`.
- Changes only `percentage` semantics from max-normalized width to `count / totalCount * 100`; ranking remains count descending with the existing deterministic label tie-breaker.

- [ ] **Step 1: Add a failing source contract for real decade share.**

Assert the Lifetime page source computes a total decade count and derives percentage from each count divided by that total, and no longer divides decade count by `maxDecade`.

- [ ] **Step 2: Run the focused web test and verify the expected failure.**

Run: `pnpm --filter web test -- --test-name-pattern="decade share"`

Expected: FAIL because the current page uses `maxDecade` normalization.

- [ ] **Step 3: Implement the minimal decade-share change.**

Keep the existing weighted decade aggregation and sorted order, compute `totalDecadeCount` from the ordered values, and derive each item’s percentage from that total. Do not alter diary loading, heatmap data, or other `buildAnalytics` outputs.

- [ ] **Step 4: Run the focused test and verify it passes.**

Run: `pnpm --filter web test -- --test-name-pattern="decade share"`

Expected: PASS.

### Task 4: Add a reusable Recharts composition bar chart

**Files:**
- Create: `apps/web/components/profile/profile-composition-bar-chart.tsx`
- Modify: `apps/web/components/profile/profile-watching-habits-card.tsx:1-240`
- Test: `apps/web/lib/profile-watching-habits-card.test.mjs`

**Interfaces:**
- `ProfileCompositionBarChart` accepts ordered items with `label`, `count`, `percentage`, plus localized count/percentage tooltip labels and a color variant.
- It renders one responsive vertical-layout `BarChart`, Kino-compatible bars, readable Y-axis labels, percentage `LabelList`, and a tooltip containing label, count, and percentage.

- [ ] **Step 1: Add failing source contracts for the shared chart.**

Assert the habits card imports/renders one shared chart component for both genre and decade data, contains Recharts-backed chart behavior through that component, and contains no `BarRow`, CSS `style={{ width: ... }}`, or manual genre/decade track/fill implementation.

- [ ] **Step 2: Run the focused card test and verify the expected failure.**

Run: `pnpm --filter web test -- --test-name-pattern="composition chart|manual"`

Expected: FAIL because the current card renders `BarRow` CSS bars.

- [ ] **Step 3: Implement the shared chart with existing chart primitives.**

Use `ChartContainer`, `ChartTooltip`, `BarChart`, `Bar`, `LabelList`, `XAxis`, and `YAxis`. Keep axes/grid subtle or hidden, use `count` for bar length, `percentage` for end labels, and read tooltip values from the same item datum. Pass all display strings from the card so the chart has no hardcoded user-facing copy.

- [ ] **Step 4: Replace only the Genres and Decades card bodies.**

Map the existing top four `genreStats` and `decades` items to the shared chart without a second aggregation. Keep existing loading, retry, empty states, card titles, ranking, responsive four-column layout, and genre/decade color distinction.

- [ ] **Step 5: Run the focused card tests and typecheck the web package.**

Run: `pnpm --filter web test -- --test-name-pattern="composition chart|manual"` and `pnpm --filter web typecheck`

Expected: PASS and exit code 0.

- [ ] **Step 6: Commit the chart change.**

```bash
git add apps/web/components/profile/profile-composition-bar-chart.tsx apps/web/components/profile/profile-watching-habits-card.tsx apps/web/lib/profile-watching-habits-card.test.mjs
git commit -m "feat: replace lifetime composition bars with charts"
```

### Task 5: Update the Ratings card and distribution tooltip

**Files:**
- Modify: `apps/web/components/profile/profile-rating-stats-card.tsx:1-304`
- Modify: `apps/web/lib/profile-rating-stats-card.test.mjs`

**Interfaces:**
- Uses the extended `ProfileRatingStats` result without new queries or local analytics.
- Permanent distribution labels render `dataKey="percentage"` and localized percentages.
- Tooltip receives the same row’s `count` and `percentage` and renders both localized values.

- [ ] **Step 1: Add failing rating-card contracts.**

Assert the source renders `movieAverageRating`, `seriesAverageRating`, and `mostRatedGenre`, does not use `fiveStarRate` in the insight grid, uses `percentage` for `LabelList`, and has tooltip copy paths for both count and percentage. Assert the full ten-bucket data is preserved by mapping the existing `stats.distribution` rather than creating a separate dataset.

- [ ] **Step 2: Run the focused rating-card tests and verify the expected failure.**

Run: `pnpm --filter web test -- --test-name-pattern="rating stats card"`

Expected: FAIL because the current card renders five-star rate and count labels.

- [ ] **Step 3: Implement localized rating insight presentation.**

Keep the overall average hero. Add a compact series-average insight showing the series average and a localized `vs {{rating}} for movies` comparison, plus a most-rated genre insight showing the genre name and pluralized rating count. Retain the five highest-rated category insights below them. Use locale number formatters and translated em-dash fallback.

- [ ] **Step 4: Implement the percentage label and dual-value tooltip.**

Keep the existing sorted distribution datum. Set the visible `LabelList` data key to `percentage` and format it with the active locale. Replace the single-value tooltip formatter with a small card-local tooltip that reads `payload[0].payload.count` and `.percentage`, and renders localized rating-count and percentage rows.

- [ ] **Step 5: Run focused rating tests and existing profile tests.**

Run: `pnpm --filter web test -- --test-name-pattern="rating stats card|profile"`

Expected: PASS.

### Task 6: Add weekday/weekend UI under Movies × Series

**Files:**
- Modify: `apps/web/components/profile/profile-watching-habits-card.tsx:25-240`
- Modify: `apps/web/lib/profile-watching-habits-card.test.mjs`

**Interfaces:**
- Consumes `viewingStats.weekdayMediaSplit` and `.weekendMediaSplit`.
- Renders media type labels and percentages from numeric analytics, never presentation sentences from core.

- [ ] **Step 1: Add failing source contracts for weekday/weekend stats.**

Assert the Movies × Series card reads both split fields, renders translated Weekdays and Weekends labels, and formats the dominant type and percentage through localized values rather than a hardcoded sentence.

- [ ] **Step 2: Run the focused card test and verify the expected failure.**

Run: `pnpm --filter web test -- --test-name-pattern="weekday|weekend"`

Expected: FAIL because the current card has no split fields or metrics.

- [ ] **Step 3: Implement a compact split metric block.**

Add two small metrics beneath the existing composition bar. For each non-empty split, show the dominant translated movie/series label and localized percentage; for zero data, render the existing localized no-viewing state or a translated dash without producing `NaN`/`Infinity`. Preserve the existing overall time-based composition bar.

- [ ] **Step 4: Run focused habits tests and web typecheck.**

Run: `pnpm --filter web test -- --test-name-pattern="weekday|weekend|watching habits"` and `pnpm --filter web typecheck`

Expected: PASS and exit code 0.

### Task 7: Complete Lifetime Statistics localization

**Files:**
- Modify: `apps/web/components/profile/profile-rating-stats-card.tsx`
- Modify: `apps/web/components/profile/profile-watching-habits-card.tsx`
- Modify: `apps/web/components/profile/profile-stats-page.tsx`
- Modify: `locales/en/translation.json`
- Modify: `locales/pt/translation.json`
- Modify: `locales/fr/translation.json`
- Modify: `locales/it/translation.json`
- Modify: `locales/no/translation.json`
- Test: `apps/web/lib/profile-lifetime-i18n.test.mjs`

**Interfaces:**
- All strings visible on the Lifetime Statistics page resolve through existing `t`/`useTranslation` APIs.
- Count phrases use plural keys such as `stats.ratingsCount_one` and `stats.ratingsCount_other` through the existing plural resolver.

- [ ] **Step 1: Add failing locale parity/source audit tests.**

Create a test that loads all five locale JSON files and asserts each required new key exists, including average-series/movie labels, comparison text, most-rated genre, rating counts, weekdays/weekends, percentage, tooltip labels, movies, and series. Scan the Lifetime page/card source for literal `stats.*`/`common.*` output risks and hardcoded user-visible `ratings`, `episodes`, `series`, `movies`, `rewatches`, `eps`, or `vs` strings.

- [ ] **Step 2: Run the audit and verify the expected failure.**

Run: `pnpm --filter web test -- --test-name-pattern="Lifetime Statistics localization"`

Expected: FAIL because several current locale resources contain untranslated English values/raw-key fallbacks and the card has hardcoded count presentation.

- [ ] **Step 3: Add complete translations in every supported locale.**

Add the new base/plural keys to all five locale resources and replace the existing untranslated Lifetime `stats` values found by the audit. Keep translation nesting and existing key conventions. Do not change Monthly Recap data or behavior.

- [ ] **Step 4: Route all affected page copy through translations.**

Replace hardcoded visible strings and raw concatenation in the Lifetime page/cards with `t` calls and locale formatters, including count phrases and chart tooltip labels. Keep genre names supplied by the existing localized genre dataset.

- [ ] **Step 5: Run localization tests and existing i18n tests.**

Run: `pnpm --filter web test -- --test-name-pattern="Lifetime Statistics localization|i18n|profile"`

Expected: PASS.

### Task 8: Full verification and regression review

**Files:**
- Inspect: all files changed by Tasks 1–7
- Test: existing core and web profile/statistics test suites

- [ ] **Step 1: Run the focused core analytics tests.**

Run: `pnpm --filter @kino/core test -- --test-name-pattern="rating|genre|distribution|viewing breakdown|media split|profile stats"`

Expected: PASS.

- [ ] **Step 2: Run the focused web Lifetime Statistics tests.**

Run: `pnpm --filter web test -- --test-name-pattern="rating stats card|watching habits|Lifetime Statistics localization|profile stats|profile.*heatmap|highs and lows|milestones"`

Expected: PASS.

- [ ] **Step 3: Run all existing package tests.**

Run: `pnpm --filter @kino/core test` and `pnpm --filter web test`

Expected: PASS with zero failures.

- [ ] **Step 4: Run the required workspace typecheck.**

Run: `pnpm typecheck`

Expected: PASS with exit code 0.

- [ ] **Step 5: Inspect the final diff and confirm scope.**

Run: `git diff --stat; git diff --check; git status --short`

Confirm only Lifetime Statistics analytics/types/cards/translation/tests and the new plan/spec files changed; confirm no Monthly Recap behavior, settings statistics, parallel query, or old genre/decade CSS bars were introduced.

- [ ] **Step 6: Commit the completed implementation.**

```bash
git add packages/core/src/types.ts packages/core/src/profile-stats.ts packages/core/src/profile-stats.test.mjs packages/core/src/database.ts apps/web/lib/profile-query-options.ts apps/web/lib/profile-query-service.ts apps/web/components/profile/profile-composition-bar-chart.tsx apps/web/components/profile/profile-rating-stats-card.tsx apps/web/components/profile/profile-watching-habits-card.tsx apps/web/components/profile/profile-stats-page.tsx apps/web/lib/profile-rating-stats-card.test.mjs apps/web/lib/profile-watching-habits-card.test.mjs apps/web/lib/profile-lifetime-i18n.test.mjs locales/en/translation.json locales/pt/translation.json locales/fr/translation.json locales/it/translation.json locales/no/translation.json
git commit -m "feat: complete lifetime statistics mockup differences"
```
