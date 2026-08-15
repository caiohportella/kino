# Lifetime Statistics Mockup Differences Design

## Goal

Update only the remaining Lifetime Statistics differences from the current implementation: rating insights and distribution presentation, weekday/weekend media splits, Recharts composition charts for genres and decades, and complete localization for text visible on the Lifetime Statistics page.

## Scope boundaries

- Reuse the existing `ProfileRatingStatsCard`, `ProfileWatchingHabitsCard`, rating query, viewing-breakdown query, diary query, genre query, and core analytics functions.
- Do not add parallel lifetime queries or duplicate TMDB requests.
- Do not change Monthly Recap behavior, Settings/profile shared statistics behavior, the lifetime page order, heatmap behavior, milestones, highs/lows calculations, hero/header, or episode-runtime work.
- Preserve Kino styling, Base UI components, responsive layout, and existing card composition.
- Keep calculations in core analytics and localized formatting/rendering in web components.

## Architecture and data flow

The existing `getProfileRatingStatsByProfileId` query already combines `title_ratings` and `episode_ratings` and passes both datasets to `calculateProfileRatingStats`. The result type will gain `movieAverageRating`, `seriesAverageRating`, and `mostRatedGenre`; existing fields remain for compatibility. Movie averages use user movie ratings, and series averages use user episode ratings associated with TV titles. `mostRatedGenre` uses the existing genre rating aggregation and sorts by rating count, with deterministic tie-breakers.

The existing viewing-breakdown query already loads movie diary watch events and episode watch-history rows. `calculateProfileViewingBreakdownStats` will derive `weekdayMediaSplit` and `weekendMediaSplit` from those rows. Each valid movie diary event contributes one movie event; each valid TV episode watch/rating event contributes one series event. Rewatches retain the same event semantics. Day-of-week classification uses the existing UTC convention used by the viewing-breakdown analytics. Empty buckets return zero counts, zero percentages, and `dominantType: null`; no percentage can be `NaN` or `Infinity`.

Genre data continues to come from the existing `calculateProfileGenreStats` result. Decades continue to come from the existing Lifetime page analytics and ranking, but their percentage becomes an actual share of the aggregated decade count rather than a value normalized to the largest item. Chart bar geometry remains Recharts-scaled automatically; displayed labels and tooltips use the actual percentage/share.

## Component design

`ProfileRatingStatsCard` keeps its consolidated two-column layout and Recharts distribution. The left side contains the existing overall average, average series rating versus average movie rating, most-rated genre with count, and the existing highest-rated genre/decade/studio/actor/actress insights. The previous five-star-rate insight is removed from this insight grid but remains in the core result for compatibility. Distribution labels use each bucket’s `percentage`; a custom localized tooltip reads the same chart datum and shows bucket label, raw count, and percentage.

`ProfileWatchingHabitsCard` keeps the existing Movies × Series time composition bar and adds weekday/weekend preference metrics beneath it. These metrics render the dominant media type and percentage when data exists, with localized Movies/Series, Weekdays/Weekends, and percentage formatting. The Genres and Decades cards render a single reusable internal horizontal Recharts chart component that accepts label, count, percentage, color, and localized tooltip labels. It preserves incoming order and uses Kino green bars for genres with an understated alternate tone for decades.

The shared chart component will be limited to the profile Lifetime Statistics use case. It will not alter the generic chart primitives or affect other profile/settings components.

## Localization

All visible Lifetime Statistics strings will resolve through `useTranslation`, including labels, tooltip values, weekday/weekend headings, media names, comparison text, counts, and fallback/empty states. Translation resources will be updated for `en`, `pt`, `fr`, `it`, and `no`, including plural variants where a count is interpolated. Number and percentage values use the active locale’s `Intl.NumberFormat`; no analytics object contains presentation sentences. Genre names continue to use the already-localized genre data supplied to the page.

The audit covers the Lifetime Statistics hero, Watch Activity, Highs & Lows, Milestones, Ratings, Watching Habits, and Monthly Recap CTA. Monthly Recap functionality and its data behavior remain unchanged; only shared page-visible translation gaps may be corrected.

## Testing strategy

Core tests will cover:

- separate movie and series averages from user rating rows;
- count-ranked most-rated genre versus average-ranked highest-rated genre;
- all ten half-star distribution buckets and count-derived percentages;
- weekday/weekend event counts, percentages, dominant type, and zero-data behavior.

Web contract tests will cover:

- rating chart data/labels/tooltips using `count` and `percentage`;
- reusable genre/decade chart use of existing aggregated data and absence of the old manual width-bar implementation;
- Lifetime card wiring for weekday/weekend stats;
- no raw `stats.*` or `common.*` keys in the Lifetime page source and presence of new translation keys in all supported locales.

Verification will run the focused core/web statistics tests, existing profile/statistics tests, and `pnpm typecheck`.

## Self-review

- No new database/API field is required; all new values derive from already-loaded datasets.
- No presentation strings are introduced in core analytics.
- The day-of-week convention is explicitly UTC and matches current viewing-breakdown behavior.
- Existing type fields are preserved for compatibility with unaffected consumers.
- Genre and decade rankings remain input-ordered; only chart rendering and decade share semantics change.
- Monthly Recap behavior is explicitly outside the implementation scope.
