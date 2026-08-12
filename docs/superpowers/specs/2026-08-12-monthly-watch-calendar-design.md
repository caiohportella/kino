# Monthly Watch Calendar and Comparison Styling Design

## Goal

Replace the monthly recap's square activity heatmap with a full month watch calendar while preserving Kino's existing aggregation semantics, and improve the previous-month comparison card with semantic visual delta cues.

## Local implementation findings

- `apps/web/components/profile/profile-monthly-recap-page.tsx` currently renders the monthly activity section with the reusable `HeatmapCalendar`.
- `packages/core/src/profile-stats.ts` owns monthly recap aggregation. `summarizeMonth` already maintains one local-date `dailyActivity` map, `activeDays`, movie and episode totals, runtime totals, and previous-month comparison inputs.
- Movie diary rows already contribute movie runtime. Episode activity already uses persisted `runtime_minutes`; no new runtime query or fallback system is needed.
- `apps/web/components/ui/heatmap-calendar.tsx` and `apps/web/components/profile/profile-activity-heatmap.tsx` contain Kino's existing green intensity scale, legend treatment, tooltip patterns, and responsive heatmap conventions.
- `apps/web/components/profile/previous-month-card.tsx` renders the comparison rows. The recap page already supplies server-computed deltas and uses `formatWatchTimeCompact` for duration values.
- `apps/web/lib/profile-recap.ts` provides UTC-safe month shifting and localized month formatting. `apps/web/lib/profile-stats.ts` provides compact and accessible duration formatting.

## Data flow

Extend the existing `ProfileMonthlyRecapActivityDay` shape additively:

```ts
export interface ProfileMonthlyRecapActivityDay {
  date: string
  entries: number
  moviesWatched: number
  episodesWatched: number
  minutes: number
}
```

`summarizeMonth` continues to use one `dailyActivity` map keyed by Kino's existing local date key. Each in-scope movie diary event increments `entries`, `moviesWatched`, and movie runtime. Each in-scope episode event increments `entries`, `episodesWatched`, and persisted episode runtime. Existing rewatch, month-range, total, and comparison semantics remain unchanged.

The monthly recap API and query options remain unchanged except for the additive fields in returned daily entries. No parallel query, title localization request, or second raw-data traversal is introduced.

The web calendar derives all presentation-only values from the same daily map:

- calendar cells and month positioning
- watch-time intensity
- active-day count
- longest consecutive active-day streak
- most active day, ranked by total minutes then earliest date
- biggest binge day, ranked by episode count, then total minutes, then earliest date

## Calendar component

Create a focused `MonthlyWatchCalendar` component under `apps/web/components/profile/`. It receives the selected year/month, daily activity, locale, and translation function or localized labels. It does not own data fetching.

The calendar renders a seven-column grid in the locale's established first-day order. It creates empty transparent slots for leading and trailing positions outside the selected month and never reads activity data for those slots. Real days show their day number, compact movie/episode counts, and formatted duration. On narrow screens, labels use compact existing translation forms where available while preserving usable seven-day semantics and avoiding horizontal overflow.

Intensity is based on `minutes`, relative to the selected month. Reuse the existing Kino green scale and legend labels from the heatmap implementation. The normalization should preserve the current heatmap's relative/binning behavior where practical and avoid an extreme day flattening all other active days.

Active cells expose keyboard-focusable semantics and complete localized accessible labels containing the date, movie count, episode count, and watch duration. Tooltips reuse existing patterns and add no API calls. The most active day receives a restrained accent border or icon plus accessible explanatory text; color is not the only indicator.

The monthly recap heading uses localized translation keys. Existing month/date and duration helpers are reused. Title names are not added to tooltips.

## Comparison styling

Keep the existing `ProfileMonthlyRecapComparison` data and all four current metrics. Extend the comparison row presentation with the numeric delta and a display classification. Render:

- positive delta: existing Kino green and an upward icon
- negative delta: restrained existing muted/down semantic color and a downward icon
- zero delta: neutral muted text and a minus icon

Duration values continue through `formatWatchTimeCompact`; zero and negative duration deltas are displayed as formatted absolute values with the correct sign. The localized previous-month heading, empty state, and metric labels remain unchanged.

## Testing

Extend `packages/core/src/profile-stats.test.mjs` with real aggregation tests for movie-only, episode-only, mixed-day, runtime sum, active days, streaks, most-active ranking, binge ranking and ties, empty days, month boundaries, leap February, timezone-safe date grouping, and unchanged totals/comparison deltas.

Add focused web tests for month grid placement, locale-aware weekday ordering, inactive outside-month cells, intensity/legend reuse, accessible active-day labels, most-active indication, and positive/negative/zero comparison styling. Update the existing heatmap test only to distinguish lifetime heatmap coverage from the new monthly calendar; lifetime behavior remains unchanged.

## Files in scope

- Modify `packages/core/src/types.ts`.
- Modify `packages/core/src/profile-stats.ts`.
- Modify `packages/core/src/profile-stats.test.mjs`.
- Create `apps/web/components/profile/monthly-watch-calendar.tsx`.
- Create focused web calendar tests.
- Modify `apps/web/components/profile/profile-monthly-recap-page.tsx`.
- Modify `apps/web/components/profile/previous-month-card.tsx`.
- Add only necessary translation keys to all supported locales.

Unrelated recap sections, lifetime statistics, data-fetching semantics, title localization behavior, and existing monthly comparison calculations remain unchanged.
