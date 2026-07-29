# Search, Reviews, Responsive Titles, and Progressive Profiles Design

## Goal

Correct Kino's remaining review layout, profile review carousel, semantic person search, rating presentation, search width and skeleton, mobile title responsiveness, and profile loading bottlenecks without redesigning unrelated surfaces or weakening localization, accessibility, caching, review behavior, TMDB integration, or the shared search architecture.

## Architectural ownership

`packages/core` owns platform-neutral contracts and algorithms:

- normalized search entities and bounded score components;
- person-expansion qualification from explicit query and provider evidence;
- credit normalization, deterministic evidence consolidation, deduplication, fusion, and ranking;
- title-card presentation contracts and localized person-department mapping;
- profile query-key factories and named cache-policy definitions;
- bounded-concurrency utilities;
- platform-neutral invalidation descriptors expressed as a discriminated union.

Shared core supplies descriptors rather than executing cache mutations. It must not import React, Next.js, Expo, Supabase, the Upstash SDK, application environment modules, or application persistence. Search and indexing remain separate dependency domains: search must not import indexing, indexing must not import search, and ranking remains exclusively in shared core.

Web and mobile applications own:

- React Query options, hooks, cache writes, and invalidation execution;
- Supabase access;
- TMDB requests;
- Upstash relationship-cache access and refresh scheduling;
- rendering, navigation, development metrics, and persistence adapters.

Each application adapter handles every shared invalidation descriptor exhaustively so a new descriptor causes a type error until both platforms define its behavior.

## Search architecture

### Person qualification and orchestration

Shared core determines whether a normalized person candidate qualifies for relationship expansion. The decision uses normalized intent, provider confidence, lexical name and alias evidence, and relationship wording. Applications supply provider evidence and perform resulting reads and fetches, ensuring web and mobile share qualification semantics and thresholds.

The application search orchestrator:

1. Resolves the highest-confidence person candidate.
2. Reads a versioned, size-bounded relationship-cache record whose freshness and structural completeness are evaluated independently.
3. Uses a stale but structurally complete record immediately and schedules a non-blocking refresh.
4. For a missing or structurally incomplete record, supplements from TMDB combined credits before finalizing expansion when the latency budget permits.
5. Schedules application-owned cache refreshes without introducing side effects into shared-core algorithms.
6. Normalizes relationship evidence into shared movie and series candidates.
7. Passes relationship, semantic, lexical, title, person, and user candidates to the shared-core fusion and ranking pipeline.

Failure of relationship expansion does not alter ordinary title, person, or user ordering semantics beyond the absence of relationship-derived candidates.

### Credit relationships and ranking

Relationship ranking exposes independently bounded, versioned score components:

```ts
type CreditSearchScore = {
  relationshipScore: number
  semanticScore: number
  popularityScore: number
  voteConfidenceScore: number
  castOrderScore: number
}
```

Every component uses a documented normalized range. Provider-native scores are normalized before entering fusion. For qualified person queries, relationship evidence dominates generic semantic similarity; semantic evidence may refine additional query terms but cannot discard a valid exact relationship.

Role-specific rules prioritize acting cast, low cast order, directing, writing, and creating as the detected intent requires. Archive, self, uncredited, one-off guest, and low-information evidence is penalized. Penalties apply to individual credit evidence before consolidation. When several credits point to one entity, deterministic rules retain or combine the strongest relevant evidence so a weak role cannot suppress a stronger role.

True duplicates use `mediaType + tmdbId`. Separate sequels, spin-offs, revivals, seasons represented as distinct TMDB entities, and franchise entries remain distinct. Movies and series keep their correct media types and are deduplicated independently.

### Relationship cache and indexing

Relationship caching uses a versioned bounded person record or separate bounded relationship records. It does not store an unbounded filmography in vector metadata. Records contain enough data to evaluate identity, department, aliases, credit relationships, freshness, completeness, and schema compatibility. Old or incomplete records can be invalidated and rebuilt. Current cached relationships may be returned while stale refreshes run.

### Presentation adapter and ratings

Every title result passes through one shared presentation adapter contract before reaching a platform title card. The contract distinguishes TMDB ID, media type, localized title, localized poster, release year, canonical route, optional semantic context, semantic relevance, TMDB vote average, Kino average, and final card display rating.

Semantic relevance never occupies a rating field. The adapter uses the same rating source and scale as existing home-page title cards and normalizes exactly once through the established helper when required. Missing TMDB vote averages remain `null` or absent; they never become zero, undergo repeated division, or inherit relevance scores.

People results use a shared localized department mapper with Kino's supported vocabulary and a neutral localized Person fallback.

### Search layout and loading

Search controls occupy a dedicated form row. Clear and filters constrain only that row. Discovery, loaded results, and skeleton sections occupy the full standard page container beneath it.

Loaded titles and skeletons reuse the same responsive row or grid geometry. Skeleton capacity derives from actual available width, card width, gap, and container padding, with enough cards for wide desktop displays. Movies, series, and people receive complete section-shaped loading states when applicable.

## Review and responsive title design

### Title-page reviews

Review cards use a two-column grid with a bounded avatar column and `minmax(0, 1fr)` content column. The author metadata and owner actions share only the header row. The date, full review body, and like action use the entire content column. The review body has no narrow maximum width, preserves whitespace, and wraps long content safely beneath the owner-action area.

On narrow screens, owner actions may wrap inside the header row but cannot overlap author metadata or reduce the width available to the review body.

### Profile review carousel

Profile reviews use the same horizontal-row interaction model as watched titles:

- exactly two equal cards fit on desktop;
- the two-card calculation uses the existing row's actual gap and container geometry, preferably its exposed width token or CSS variable;
- mobile shows one readable card or one card with a subtle preview;
- mouse, trackpad, touch, keyboard focus, hidden scrollbar, and existing snapping behavior are preserved;
- previous and next controls match other profile rows;
- title navigation does not capture Like, author, Edit, or Delete interactions;
- previews clamp to three or four desktop lines and about four mobile lines;
- latest-first sorting uses a deterministic review-ID secondary ordering when timestamps match.

Native focus order and activation remain authoritative. Row-level arrow scrolling must not intercept keys while focus is inside a link, button, menu, or editable control.

The section distinguishes pending, success-empty, success-content, retained-refresh, and failure. Its skeleton uses identical row geometry with two desktop review cards. Pending or failure never appears as empty. Existing content retains dimensions and scroll position during refresh and remains visible if a refresh fails.

### Mobile title identity and actions

Only the primary mobile title identity block is centered: poster, media label, date/year/runtime metadata, title, genres, and compact supplementary metadata. Desktop preserves its current left alignment. Synopsis, reviews, credits, episodes, and community content remain left aligned.

The design remains stable with long localized names, many genres, absent runtimes, date ranges, missing posters, very narrow phones, and landscape orientation through wrapping and intrinsic sizing rather than duplicated markup or fixed widths.

All intended full-width mobile actions share one width-owning container. The outermost interactive element or link wrapper and its visual button both use full width. Nested content cannot reintroduce intrinsic shrinkage. Desktop breakpoints restore existing inline or content-sized behavior. This applies consistently to Watchlist, Diary, Share, Buy Tickets, and eligible streaming actions while preserving provider destinations and availability rules.

## Progressive profile architecture

### Four query slices

1. **Profile identity:** the only page-level blocking query. It contains stable public identity fields and is sufficient to render the header.
2. **Viewer relationship and counts:** follow state, follower/following counts, permissions, and actions, scoped by both profile and authenticated viewer.
3. **Profile content sections:** separate queries for watched movies, watched series, statistics, watchlists, reviews, and ratings. Each section renders and fails independently.
4. **Live series availability:** background enrichment keyed by profile, locale, and region. Stored progress and cached localized summaries render first.

Viewer relationship may start concurrently with identity when routing already provides the canonical profile identifier. Username-based routes start it immediately after identity resolves the canonical identifier.

Only profile-not-found or identity failure reaches the page-level error state. A never-loaded secondary section may show its own skeleton. A section with successful prior data retains that data during refresh and retains it if refresh fails.

### Cache ownership and keys

Stored user activity and progress remain valid independently of locale. Localized title presentation and image summaries live in separate locale/region-sensitive entries and are composed into section view models.

Shared factories include schema version and every response-shaping input: canonical profile identifier or username, public/authenticated scope, viewer ID, locale, region, page, and filters. Public and viewer-specific responses cannot collide; profiles, locales, and regions cannot reuse incompatible data.

Named cache policies cover:

- stable identity;
- viewer relationship and counts;
- public statistics and watchlists;
- reviews with previous-data retention;
- established 24-hour/7-day localized summaries;
- shorter live availability without full-library focus refreshes.

Applications use shared factories and policies rather than scattered handwritten arrays or arbitrary inline durations.

### Availability enrichment

Watched-series rows initially use Kino's stored progress and cached localized summaries. The background orchestrator evaluates a bounded candidate window rather than queueing the entire library. It prioritizes visible or recently watched series; later candidates refresh through visibility, navigation intent, or subsequent bounded batches.

Necessary season requests:

- use React Query keys containing title, season, locale, and region;
- deduplicate across cards, prefetch, and navigation;
- run through a shared bounded executor with a documented maximum concurrency;
- isolate each season and series failure;
- retain previous successful enrichment;
- avoid focus-driven full-library refreshes;
- do not fan out solely because cards mounted.

Failed enrichment preserves stored progress and reports only an item- or section-level development refresh error.

### Prefetch

Reusable platform helpers share the same query options as navigation:

- web triggers identity and bounded above-the-fold watched-title summary prefetch on pointer hover, keyboard focus, and route intent;
- mobile triggers the same safe data on touch start, press, or navigation intent;
- review-author links use the same helper;
- React Query deduplicates prefetch and navigation.

Prefetch excludes full review pages, full watchlists, full libraries, season details, and full availability.

### Mutation invalidation

Shared core supplies a discriminated union of minimum-scope invalidation descriptors. Platform adapters exhaustively translate them into React Query cache writes or invalidations.

- Review creation, editing, deletion, liking, and unliking update relevant title/profile review caches and required counts only.
- Follow/unfollow updates relationship and counts, not watched sections.
- Diary, rating, and progress mutations update associated activity summaries, statistics, ratings, and availability as required.
- Watchlist mutations update affected watchlist scopes.
- Identity, avatar, and banner mutations update identity and dependent public presentation.

No mutation universally invalidates the former profile aggregate.

### Development observability

Development-only metrics record:

- time to identity and header;
- time to first content section and each section;
- time until nonessential sections settle;
- observable cache reuse;
- total TMDB requests;
- full-season requests;
- bounded candidate and concurrency activity;
- availability failures.

Metrics exclude tokens, private fields, review text, and sensitive relationship details. The final report distinguishes structural fixture-based before/after request counts from trustworthy live measurements.

## Persistence

Cross-session React Query persistence is deferred unless the repository already contains a safe adapter that makes the change small and low risk. Persistence is not a prerequisite for query splitting, progressive rendering, previous-data retention, prefetch, invalidation, or fan-out reduction.

Any future persistence must explicitly allowlist safe public data, include schema busting and maximum age, isolate locale/region/user variants, clear viewer-scoped data on logout, enforce storage limits, and exclude sessions, tokens, permissions, private data, mutations, and credentials.

## Error handling

- Identity failure and profile-not-found use page-level states.
- Secondary profile sections have independent error states and preserve prior data.
- Relationship expansion degrades to ordinary search without reordering unrelated evidence.
- Individual TMDB credit or season failures cannot fail search or profile pages.
- Missing ratings and departments use explicit absent or neutral presentation rather than misleading values.
- Background refreshes never replace successful content with initial skeletons or transient empty states.

## Testing and required verification

Required deterministic verification:

- person qualification, exact and natural-language relationship queries, stale versus incomplete cache behavior, TMDB fallback orchestration, deterministic evidence consolidation, ranking, and franchise preservation;
- rating-source separation, nullable ratings, single normalization, localized title/poster/route adaptation, and profession localization;
- responsive full-width search results and skeleton capacity;
- title-review width and wrapping;
- profile review carousel geometry, interactions, ordering, retained scroll state, and section states;
- mobile title identity centering, desktop preservation, edge constraints, and outer-wrapper action width;
- identity-first profile rendering and independent secondary sections;
- stored watched progress independent of localized summaries and availability;
- viewer/profile/locale/region key collision prevention;
- previous-data retention and refresh-failure behavior;
- prefetch/navigation deduplication;
- bounded availability candidate windows, request counts, maximum concurrency, and failure isolation;
- exhaustive mutation invalidation adapters;
- architectural boundary checks;
- accessibility assertions;
- Biome, lint, type-check, repository tests, focused integration tests, responsive assertions, injected-provider fixtures, and production build.

Optional environment-permitting validation:

- live TMDB credit verification;
- live Upstash relationship-cache verification;
- production-like latency and request measurements.

CI and required acceptance never depend on external services.

## Migration, rollback, and removal

Implementation proceeds in independently testable stages:

1. Extend shared contracts and algorithms.
2. Migrate web and mobile search orchestrators and consumers.
3. Migrate review, search layout, skeleton, and responsive title UI.
4. Split profile queries and progressive rendering.
5. Add bounded availability, prefetch, invalidation, and metrics.
6. Remove obsolete monolithic paths only after every dependent consumer has migrated.

For every stage:

- verify previous behavior before removing legacy code;
- keep old and new implementations coexistable until the new path passes verification;
- preserve a clean revert path without a data migration;
- remove obsolete code only after all dependents migrate and pass required checks;
- continuously assert architectural ownership, not only runtime behavior.

## Final reporting

The implementation report will:

- explain why person searches missed important credits and how qualification, expansion, consolidation, and ranking changed;
- explain why semantic scores appeared as ratings and identify the corrected title-rating source;
- describe shared title adapters, localized professions, full-width search layout, and skeleton capacity;
- describe title-review width, the two-card profile review carousel, mobile title centering, and action widths;
- show original and final profile request graphs;
- identify remaining blocking data;
- list query factories, policies, progressive sections, and invalidation behavior;
- report structural and available live TMDB request counts, bounded candidate window, and maximum season concurrency;
- explain previous-data retention and profile prefetch;
- state that persistence was implemented or deferred and why;
- enumerate tests and commands with actual outcomes;
- list every changed file and remaining performance risks.
