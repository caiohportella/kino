# Consistent Rated Contributors in Recaps

## Goal

Improve the monthly and lifetime highest-rated actor, actress, production-company, genre, and decade statistics so they represent work the user rates highly consistently, rather than selecting a category attached to one exceptional title.

## Scope

The change is limited to the existing core profile-statistics pipeline. It will extend `packages/core/src/profile-stats.ts`, the related core types, and the existing profile-statistics tests. The existing database queries already select the metadata required by the calculation, so there will be no schema migration, new persisted statistic, or additional TMDb request.

Existing exposure metrics remain separate:

- Monthly `topActor` and `mostWatchedStudio` continue to represent viewing exposure.
- New monthly highest-rated fields represent rating quality and consistency.
- Lifetime highest-rated fields retain their existing names and display integration.

## Existing data and semantics

The calculation consumes the existing joined title and rating rows:

- `titles.cast` contains TMDb person IDs, names, gender, profile paths, and optional billing order.
- `titles.production_companies` is preferred, with `titles.tmdb_data.production_companies` as the existing fallback.
- `title_ratings` supplies movie ratings and timestamps.
- `episode_ratings` supplies series episode ratings, timestamps, and season/episode keys.
- Monthly database queries already bound diary and rating rows to the requested UTC month range.
- Lifetime queries already provide all user rating rows.

Per-episode cast credits are not present locally. Series exposure therefore uses the conservative fallback `exposureWeight = 1`; the implementation will not add episode-credit ingestion.

Title names remain canonical in core statistics and localized only by the existing web localization flow. Ranking uses title IDs, person IDs, and company IDs rather than translated names.

## Ranking model

### Canonical title scores

Each distinct rated title contributes once per person or company:

- Movies use the latest effective movie rating by `watched_at` within the supplied scope.
- Series use the average of the latest rating for each distinct rated episode key within the supplied scope. This produces one canonical series score rather than one contribution per episode.
- Null, invalid, or non-positive ratings do not contribute.
- Rewatch rows do not increase the distinct-title sample count. Repeated movie ratings resolve to the latest effective value; repeated episode ratings resolve to the latest value for that season/episode key.

The relevant-scope overall average `C` is calculated from these canonical title scores.

### Cast contribution

For a cast member with billing order `order`, use:

```ts
if (order <= 1) return 1.0;
if (order <= 4) return 0.85;
if (order <= 9) return 0.65;
if (order <= 14) return 0.4;
return 0;
```

Missing billing order is handled conservatively and does not invent a lead position. The series exposure fallback is `1`, so contribution weight is prominence weight multiplied by `1` for both movies and series until local episode-credit data exists.

Only existing TMDb gender metadata is used for gender-specific buckets: gender `2` qualifies for actor, gender `1` qualifies for actress, and other or missing values are skipped.

### Weighted raw average and confidence

For each person, aggregate qualifying distinct titles with:

```text
weightedAverage = sum(titleScore * contributionWeight) / sum(contributionWeight)
```

For each company, qualifying titles contribute equally with weight `1`.

The ranking score is Bayesian-adjusted:

```text
rankingScore = (n / (n + 3)) * weightedAverage + (3 / (n + 3)) * C
```

`n` is the number of distinct rated titles associated with the candidate. Eligibility is two distinct titles for monthly recap and three distinct titles for lifetime recap. If no candidate meets the threshold, the result is `null`.

The returned display average remains the raw weighted average; the Bayesian score is used only for ordering. Ordering is deterministic: ranking score descending, distinct title count descending, raw weighted average descending, qualifying observation count descending when available, then stable ID and name fallback.

### Genre ranking

Genres reuse the existing title genre metadata and stable genre IDs. A canonical rated title contributes once to every genre attached to it; rewatches and repeated episode ratings do not create additional title samples. Highest-rated genre uses the same Bayesian formula, relevant-scope baseline, `m = 3`, and monthly/lifetime eligibility thresholds as people and companies. The raw average remains the display value.

Most-rated genre remains a separate metric and ranks by distinct rated-title count, then raw average, then stable genre ID. It does not use rating-event or episode counts.

Genre names are never used as aggregation keys. Existing genre localization by TMDb genre ID remains responsible for display, with no new English-only labels.

### Decade ranking

Decades reuse each title's existing canonical `release_year` value. Reliable years map to `Math.floor(release_year / 10) * 10`; titles without a reliable year are excluded. Highest-rated decade uses canonical distinct-title scores, the same Bayesian formula, baseline, and eligibility thresholds. Any most-rated decade metric remains separate and uses distinct-title counts with deterministic tie-breaking. Decade labels continue through the existing locale/display convention.

## Monthly and lifetime integration

The shared ranking helper will accept already-scoped rating rows. Monthly calls it with the current month’s rows, preserving the current `createMonthRange` and database query boundaries. Lifetime calls it with all rating rows. No second date-range implementation is introduced.

The monthly recap type gains:

- `highestRatedStudio: ProfileRatedCategoryStat | null`
- `highestRatedActor: ProfileRatedCategoryStat | null`
- `highestRatedActress: ProfileRatedCategoryStat | null`

Existing genre and decade outputs are extended in place to use canonical distinct-title samples and confidence-aware ordering. Their existing display shapes remain stable.

The existing `mostWatchedStudio` and `topActor` fields are unchanged to keep exposure and quality metrics distinct. Existing localization labels and title rendering remain unchanged.

## Testing

Extend `packages/core/src/profile-stats.test.mjs` with focused tests for:

- cast prominence weights, including minor and ignored billing positions;
- Bayesian confidence preventing a one-title perfect result from beating a repeated strong result;
- distinct title counting, including movie rewatches and repeated series episodes;
- series canonical scoring and no episode-count inflation;
- missing/unknown gender exclusion;
- studio aggregation across multiple companies;
- Bayesian highest-rated genre and decade ranking;
- most-rated genre/decade separation from highest-rated metrics;
- genre and decade distinct-title counting across rewatches and series episodes;
- monthly scope isolation from lifetime rows;
- lifetime latest-rating behavior;
- deterministic tie-breaking;
- null results when eligibility thresholds are not met;
- existing monthly exposure metrics remaining separate;
- existing localization regression tests continuing to verify title display through localized-title helpers;
- stable genre-ID aggregation with existing localized genre display.

No translation keys or UI copy are added because the new values use existing statistic data paths and labels.

## Non-goals

- Do not fetch per-episode cast credits.
- Do not persist Bayesian scores or contributor statistics.
- Do not infer screen time, role classifications, or company prominence.
- Do not use translated titles for aggregation.
- Do not merge highest-rated and most-watched metrics.
- Do not rewrite unrelated profile statistics or localization infrastructure.
