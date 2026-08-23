# Discover Collections and Personalization Design

## Goal

Refactor the web Discover page so editorial collections and evidence-based personalization are distinct from mechanical filters, with collections addressable through `/discover?collection=<id>`.

## Existing context

The Discover page currently loads broad TMDb feeds on the server and renders them through `DiscoverClient`. Its filter state is synchronized in the client with `type`, `genres`, `rating`, and `page` query parameters. The current `DiscoverExploreShortcuts` component renders media-type, rating, and genre buttons that duplicate the filter UI.

Kino already has two useful personalized data sources:

- `getPersonalizedDiscoverRecommendations` uses diary entries, rated/recent seed selection, TMDb recommendations, watched-title exclusion, and deterministic ranking.
- `getDiscoverAffinityData` derives actor, director, and studio affinities from rated titles and returns unwatched TMDb credit results.

There is no existing cheap aggregated query for titles watched or rated by all followed users. This iteration will not add a social recommendation backend or client-side N+1 requests.

## User experience

Normal Discover keeps the existing broad/current sections and puts them first. Authenticated users with enough evidence then see a `For You` section containing at most two strong rails. The collection rail follows personalization, and generic sections continue afterward. Anonymous and cold-start users do not see a fake or empty personalized section.

The replacement for `Explore more` is `Explore collections`: horizontally scrollable editorial cards using the existing media-row interaction and responsive behavior. Cards link to `/discover?collection=<id>` and are not filter controls.

When a valid collection is active, Discover shows a translated title, short description, and accessible clear action above the result grid. Clearing removes only `collection`; unrelated filters remain. Explicit filters refine collection criteria rather than replacing them. Invalid collection values behave like no collection and never produce a broken state.

## Collection architecture

Create `apps/web/lib/discover/collections.ts` as the single registry and pure query boundary. It will define:

```ts
export type DiscoverCollectionId =
  | "hidden-gems"
  | "quick-watch"
  | "90s-essentials"
  | "modern-classics"
  | "critically-acclaimed"
  | "something-weird"
  | "new-this-month";
```

Each registry entry contains its ID, Tolgee title/description keys, and internal criteria. Criteria are not exposed as filter fields. Query construction is media-type aware and combines collection criteria with user filters.

Initial criteria are bounded and server/API-supported:

- Hidden Gems: strong vote average and meaningful vote count, with a popularity ceiling to reduce blockbuster-heavy results.
- Quick Watch: movie-only, runtime at most 100 minutes, and quality/vote thresholds.
- 90s Essentials: release dates from 1990-01-01 through 1999-12-31, with quality and sufficient popularity/votes.
- Modern Classics: release dates from 2000-01-01 through 2019-12-31, with strong rating and vote/popularity signals.
- Critically Acclaimed: high rating and substantial vote count.
- Something Weird: bounded mixed movie/TV discovery using Horror, Science Fiction, Fantasy, and Mystery signals plus positive-rating and reduced-popularity criteria; it is not represented as a plain genre filter.
- New This Month: recent releases using the existing `getRegionForLanguage` path and the current date window.

The query helper will define precedence explicitly: collection criteria establish the discovery context, while `type`, `genres`, and `rating` narrow it. For Quick Watch, `type=tv` produces no incompatible TV query; the UI should surface the resulting empty state without treating it as a crash. Collection identity is included in every filtered query key.

## URL and query state

`DiscoverClient` remains the owner of browser URL synchronization to avoid a second state system. It will parse the collection from `useSearchParams`, resolve it through the registry, and derive filters from the same search params.

URL operations will use the current `URLSearchParams` rather than rebuilding a blank query:

- filter changes preserve valid `collection`, `type`, `genres`, and `rating` semantics while resetting `page`;
- collection activation sets `collection`, clears stale `page`, and clears incompatible genre context while preserving applicable media type/rating;
- collection clearing deletes only `collection`;
- pagination updates only `page`.

The active collection result query will use the existing `getTmdb().discoverMedia` abstraction, bounded requests, and the existing poster/card presentation. It will not fetch a large unbounded result set in the browser. Where TMDb criteria differ by movie and TV APIs, the query builder will create the appropriate per-type parameters.

## Personalization architecture

Add a small normalized domain result in `apps/web/lib/discover/personalization.ts` or its server companion. The page will receive normalized rails rather than applying recommendation heuristics in JSX.

The first rail is `because-you-liked`, based on the strongest diary seed already selected by the existing recommendation logic. The seed title will be fetched/presented through the canonical TMDb title path so the rail can be titled with the localized title. The rail excludes the seed, watched/rated titles, duplicates, and weak result sets.

The second optional rail is the strongest existing actor/director/studio affinity row, only when it has enough unwatched results. Existing affinity ranking and localized presentation are reused. The selector returns zero, one, or two rails, never empty rails.

The following-popular rail is explicitly deferred because the current social layer lacks an aggregated endpoint and implementing it safely would expand this feature into a separate backend project.

## Components

- Replace `DiscoverExploreShortcuts` with `ExploreCollections` and a focused collection-card component.
- Add an active collection context/header component with semantic heading and accessible clear control.
- Add a personalized section/rail renderer that uses `MediaSection`/`MediaRow` and the existing poster hook.
- Keep `DiscoverClient` responsible for section placement, URL state, and composing already-normalized data; keep criteria and heuristics in library/server modules.

No new poster, carousel, route, database table, or recommendation infrastructure is required.

## Localization

All new visible copy uses the current Tolgee `t` API and default-value convention. Add keys for `discover.forYou`, `discover.exploreCollections`, every collection title/description, personalized rail labels, and the active collection clear label. Do not introduce legacy locale JSON files or hard-code translated strings in query modules.

## Error handling and accessibility

Invalid collections resolve to normal Discover. Personalized data failures are logged and degrade to no personalized rails, matching the existing server error handling. Collection queries show the existing loading, empty, error, and pagination states.

Collection cards are links with visible focus styles. The active collection heading is semantic, the clear action has an accessible translated label, and existing carousel controls and touch behavior are retained. Collection cards use compact dark surfaces, subtle borders, consistent radius/spacing, and no new promotional gradient system.

## Testing and verification

Add focused tests for:

- valid and invalid collection parsing;
- collection criteria plus explicit filter merging;
- URL activation and clearing while preserving unrelated params;
- query-key separation between normal and collection results;
- Quick Watch media-type behavior;
- seed/watched exclusion and omission of weak personalized rails;
- anonymous/cold-start omission of `For You`.

Run the relevant Discover tests, web lint, web typecheck, and build checks. Existing unrelated worktree edits must not be reverted or reformatted as part of this feature.
