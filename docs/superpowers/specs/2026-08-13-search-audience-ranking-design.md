# Kino Search Audience-Relevance Ranking Design

**Date:** 2026-08-13

## Goal

Make Kino's media-title ranking choose the result most likely intended by the audience when multiple titles are strongly related to the query. Preserve the existing Redis Search backend, textual retrieval, fuzzy/prefix matching, localization, autocomplete, caret behavior, fallback providers, and search UI.

## Current problem

The repository has two title-selection layers with different behavior:

1. The shared `packages/core` ranker assigns exact-match evidence a large fixed contribution, while audience signals have only a small influence.
2. The web hero selector in `apps/web/lib/search/featured-title.ts` independently reconstructs lexical tiers and audience scoring from presentation data.

This makes exact or near-exact obscure titles able to outrank audience-recognized titles, and allows the hero card to disagree with the authoritative search ordering. The hero selector also does not consider all normalized searchable-title evidence equally, including localized title matches.

## Design

### Shared title ranking model

Add a small shared title-ranking module in the core search package. It will expose the concepts needed by both the server ranker and the web featured-title selector:

- textual match tier;
- dampened audience prominence;
- deterministic title comparison.

The textual tiers will be ordered from strongest to weakest. Exact canonical, original, localized, and strong prefix matches will share the strong band where appropriate. Medium lexical/smart matches, fuzzy matches, and weak matches will remain below the strong band.

Audience prominence will use non-negative, finite defaults and logarithmic scaling. Vote count will contribute more than popularity. Vote average may be used only as a final weak tie-breaker and will never substitute for audience breadth.

The comparison order for title candidates will be:

```text
textual match tier
> audience prominence within the same strong tier
> textual relevance score
> weak rating tie-breaker
> stable identity
```

Weak textual candidates will not be allowed to win solely from audience metrics.

### Integration with the core ranker

`rankSearchCandidates` will apply the title-specific comparison to movie and series entities while preserving the current ranking path for people, users, relationships, and other candidate categories. Existing score components and response contracts will remain compatible; if a new internal component is needed, it will not leak Upstash-specific types into the UI.

The title ranker will continue consuming candidate evidence already produced by Redis Search, TMDb, and relationship/fallback providers. It will preserve exact, prefix, lexical, semantic, locale, and relationship signals rather than replacing them with popularity sorting.

### Integration with the hero selector

`featured-title.ts` will use the same shared title-ranking primitives instead of a separate large-constant scoring formula. Its selected result will be the highest-ranked title under the same textual-tier and audience rules used for title ranking.

The existing UI structure remains unchanged. The featured title will still be removed from the compact title list by stable media identity, and autocomplete will continue deriving completion only from the selected normalized title when it is a valid prefix continuation.

### Audience data and Redis schema

The unified `kino-search` schema already contains numeric `popularity`, `voteCount`, and `voteAverage` fields. Existing title documents and indexers already carry popularity, vote count, and vote average when available. This design does not change the Redis schema or require index recreation. Missing metrics will behave as neutral zero values during ranking.

The implementation will verify the existing title document paths for persisted titles, TMDb fallback indexing, lazy indexing, and synchronization routes. No broad catalog fetch or extra per-query TMDb request will be added.

## Alternatives considered

### Change only the core weighted score

This would improve backend ordering but leave the hero selector's independent heuristic in place, so the UI could still disagree with the ranked results.

### Change only the hero selector

This would address the visible screenshot but leave API result ordering and autocomplete evidence inconsistent.

### Use Redis `orderBy` popularity

Rejected because Upstash documents that `orderBy` changes the result score to the sort-field value, effectively replacing textual relevance with popularity ordering.

The shared title-ranking model is preferred because it preserves textual relevance while applying audience prominence only within strong textual candidates.

## Testing

Add or update tests for:

- `Duna (2021)` outranking low-audience `Duna (2018)` within the strong band;
- the Obsession regression scenario;
- a relevant title beating an unrelated highly popular title;
- a strong prefix beating a weak fuzzy result despite lower popularity;
- vote count outweighing vote average when textual relevance is comparable;
- logarithmic/dampened audience scoring and missing metrics;
- localized title matches entering the strong band;
- the featured title matching the first title under the shared ranking behavior;
- existing exact, prefix, fuzzy, autocomplete, fallback, deduplication, and user/people ranking behavior remaining intact.

## Official Upstash constraints

The implementation will continue using the installed `@upstash/redis` integration and the documented Redis Search relevance score. Redis score functions and logarithmic modifiers are valid alternatives for index-side scoring, but the current small candidate-set post-processing path is preferred for deterministic Kino-specific tiers and for keeping the existing ranking contract stable. No `orderBy` popularity sort will be introduced.
