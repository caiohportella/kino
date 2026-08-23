# Discover Collections and Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Discover’s filter-duplicating Explore More section with URL-addressable editorial collections and a bounded, evidence-based For You section.

**Architecture:** Keep `DiscoverClient` as the single browser URL-state owner. Add a typed collection registry and pure query builder under `apps/web/lib/discover`, normalize existing diary/affinity recommendations into at most two rails on the server, and render collections/personalization with existing `MediaRow`, `MediaSection`, and poster hooks.

**Tech Stack:** Next.js App Router, React client/server components, TypeScript, TanStack React Query, TMDbService, Supabase/KinoDatabaseService, Tolgee localization, Node test runner with `.mjs` tests.

**Spec:** `docs/superpowers/specs/2026-08-21-discover-collections-personalization-design.md`

## Global Constraints

- Use `/discover?collection=<id>`; do not create collection routes.
- Keep filters (`type`, `genres`, `rating`, `page`) separate from collection criteria and combine them as an intersection.
- Invalid collection IDs must resolve to normal Discover without throwing.
- Quick Watch must use movie-only runtime criteria and must not fetch hundreds of titles client-side.
- Personalized rails must use existing diary/affinity data, exclude watched titles where practical, and render at most two strong rails.
- Anonymous and cold-start users must omit `For You` without a login prompt or fake personalization.
- Reuse existing title cards, localized title/poster hooks, carousel behavior, and responsive styles.
- New user-facing text must use Tolgee calls with the project’s required `defaultValue` convention; do not add legacy locale files.
- Preserve unrelated dirty worktree changes; modify only files required for this feature.

### Task 1: Build the collection registry and pure query model

**Files:**
- Create: `apps/web/lib/discover/collections.ts`
- Test: `apps/web/lib/tests/discover/discover-collections.test.mjs`

**Interfaces:**
- `DiscoverCollectionId` is the union of the seven canonical URL IDs.
- `DiscoverCollection` exposes `id`, `titleKey`, `descriptionKey`, and internal criteria.
- `parseDiscoverCollection(value: string | null): DiscoverCollection | null` returns a registry entry for supported IDs and `null` for missing/invalid IDs.
- `buildDiscoverCollectionParams(collection: DiscoverCollection, mediaType: "movie" | "tv"): Record<string, string> | null` returns TMDb parameters or `null` when the collection has no meaningful query for that type.
- `mergeDiscoverCriteria(input: { collection: DiscoverCollection | null; filters: { mediaType: "all" | "movie" | "tv"; genreIds: number[]; minRating: number }; page: number }): { requests: Array<{ type: "movie" | "tv"; params: Record<string, string> }>; queryKey: readonly unknown[] }` produces bounded per-type requests and a key containing collection identity and all effective filter values.

- [ ] **Step 1: Write failing registry and parsing tests.**

```js
test("parses a supported collection id", async () => {
  const { parseDiscoverCollection } = await import("../../discover/collections.ts");
  assert.equal(parseDiscoverCollection("hidden-gems")?.id, "hidden-gems");
});

test("invalid collection ids resolve to null", async () => {
  const { parseDiscoverCollection } = await import("../../discover/collections.ts");
  assert.equal(parseDiscoverCollection("whatever"), null);
  assert.equal(parseDiscoverCollection(null), null);
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the registry is absent.**

Run: `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`

Expected: FAIL with the module or exported parser not found.

- [ ] **Step 3: Implement the typed registry.** Define all seven entries with translated key paths and criteria for rating, vote count, popularity, date, genre, and runtime. Keep criteria internal and use media-type-specific date fields. Return `null` for Quick Watch TV requests.

- [ ] **Step 4: Add failing criteria-merging and query-key tests.**

```js
test("explicit filters narrow Hidden Gems without replacing its criteria", async () => {
  const { mergeDiscoverCriteria, parseDiscoverCollection } = await import("../../discover/collections.ts");
  const result = mergeDiscoverCriteria({
    collection: parseDiscoverCollection("hidden-gems"),
    filters: { mediaType: "movie", genreIds: [18], minRating: 8 },
    page: 1,
  });
  assert.equal(result.requests.length, 1);
  assert.equal(result.requests[0].type, "movie");
  assert.equal(result.requests[0].params.with_genres, "18");
  assert.equal(result.requests[0].params["vote_average.gte"], "8");
  assert.ok(result.requests[0].params["vote_count.gte"]);
  assert.ok(result.queryKey.includes("hidden-gems"));
});

test("normal and collection states use different query keys", async () => {
  const { mergeDiscoverCriteria, parseDiscoverCollection } = await import("../../discover/collections.ts");
  const filters = { mediaType: "all", genreIds: [], minRating: 0 };
  const normal = mergeDiscoverCriteria({ collection: null, filters, page: 1 });
  const curated = mergeDiscoverCriteria({ collection: parseDiscoverCollection("quick-watch"), filters, page: 1 });
  assert.notDeepEqual(normal.queryKey, curated.queryKey);
});
```

- [ ] **Step 5: Implement `mergeDiscoverCriteria` with explicit precedence.** Add user genre/rating constraints to the collection params, select movie/TV requests from `mediaType`, include `page`, region-independent criteria only in this pure module, and return a stable query key.

- [ ] **Step 6: Run the focused collection tests.**

Run: `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`

Expected: PASS for supported/invalid IDs, collection criteria, Quick Watch TV behavior, filter intersection, and query-key separation.

### Task 2: Add collection-aware URL state and result querying

**Files:**
- Modify: `apps/web/components/discover/discover-client.tsx`
- Create: `apps/web/lib/discover/discover-url-state.ts`
- Test: `apps/web/lib/tests/discover/discover-url-state.test.mjs`

**Interfaces:**
- `readDiscoverUrlState(params: URLSearchParams, genres: TMDbGenre[]): { filters: DiscoverFilterState; collection: DiscoverCollection | null; page: number }` sanitizes all URL values.
- `writeDiscoverFilterUrl(current: URLSearchParams, next: DiscoverFilterState, collection: DiscoverCollection | null): string` preserves collection and applicable params while deleting stale page.
- `writeDiscoverCollectionUrl(current: URLSearchParams, id: DiscoverCollectionId | null): string` sets/clears only collection context, resets page, and removes incompatible genre state when activating a collection.

- [ ] **Step 1: Write failing URL-state tests.** Cover `collection=hidden-gems`, invalid IDs, clearing only collection from `collection=hidden-gems&type=movie&rating=7`, and activation removing `page`/`genres` while retaining `type`/`rating`.

- [ ] **Step 2: Run the focused URL tests and verify failure.**

Run: `pnpm --filter web exec node --test lib/tests/discover/discover-url-state.test.mjs`

Expected: FAIL because URL helpers do not exist.

- [ ] **Step 3: Implement pure URL helpers.** Use `URLSearchParams`, preserve unrelated parameters when clearing collection, normalize invalid numeric values, and reuse `parseDiscoverCollection` rather than duplicating ID validation.

- [ ] **Step 4: Refactor `DiscoverClient` to use the helpers.** Derive `collection` from `useSearchParams`, keep the existing filter state behavior, and ensure every URL write uses current search params instead of a blank `URLSearchParams`.

- [ ] **Step 5: Replace the filtered query parameter construction.** Use `mergeDiscoverCriteria` for requests, include its `queryKey` plus page in the TanStack key, and keep the existing balanced movie/TV result ordering and pagination. When a collection is active, show collection results even if no normal UI filter is selected.

- [ ] **Step 6: Run URL and existing Discover tests.**

Run: `pnpm --filter web exec node --test lib/tests/discover/discover-url-state.test.mjs lib/tests/discover/discover-personalization.test.mjs lib/tests/discover/discover-section-ordering.test.mjs`

Expected: PASS with existing non-collection behavior preserved.

### Task 3: Normalize personalized rail selection on the server

**Files:**
- Modify: `apps/web/lib/discover/server-personalization.ts`
- Modify: `apps/web/lib/discover/personalization.ts`
- Modify: `apps/web/app/discover/page.tsx`
- Test: `apps/web/lib/tests/discover/discover-personalized-rails.test.mjs`

**Interfaces:**
- `PersonalizedDiscoverRail` is a discriminated union for `because-you-liked` and `affinity` rails, carrying normalized `items` and the seed/source display data needed by the client.
- `selectPersonalizedDiscoverRails(input: { recommendations: TMDbTitle[]; seed: TMDbTitle | null; affinityRows: DiscoverAffinityRow[]; limit?: number }): PersonalizedDiscoverRail[]` returns at most two rails and drops weak rows.
- `getPersonalizedDiscoverRails(userId: string, language: string): Promise<PersonalizedDiscoverRail[]>` composes existing diary recommendation and affinity services with bounded failure handling.

- [ ] **Step 1: Write failing pure selection tests.** Verify a strong recommendation rail is first, the best affinity row is second, empty/short rows are omitted, and the output never exceeds two rails.

- [ ] **Step 2: Run the focused test and verify failure.**

Run: `pnpm --filter web exec node --test lib/tests/discover/discover-personalized-rails.test.mjs`

Expected: FAIL because the normalized rail selector is absent.

- [ ] **Step 3: Implement pure rail selection.** Reuse the existing `DiscoverAffinityRow` shape and minimum viable result threshold; do not put heuristic branching in React components.

- [ ] **Step 4: Extend server personalization to retain the selected recommendation seed.** Use the existing diary seed-selection logic and one bounded TMDb details lookup in the same language. Keep watched-title exclusion and recommendation ranking unchanged; return no rail when the seed or results are insufficient.

- [ ] **Step 5: Wire the page to request normalized rails for authenticated users only.** Preserve existing release/affinity server calls and catch personalization failures to `[]`. Pass `personalizedRails` to `DiscoverClient`; anonymous users receive `[]`.

- [ ] **Step 6: Run personalized and existing server tests.**

Run: `pnpm --filter web exec node --test lib/tests/discover/discover-personalized-rails.test.mjs lib/tests/discover/discover-personalization.test.mjs lib/tests/discover/discover-affinity-scoring.test.mjs`

Expected: PASS with watched exclusion and deterministic seed behavior intact.

### Task 4: Build Explore Collections and active collection context UI

**Files:**
- Create: `apps/web/components/discover/explore-collections.tsx`
- Create: `apps/web/components/discover/discover-collection-card.tsx`
- Create: `apps/web/components/discover/active-discover-collection.tsx`
- Delete: `apps/web/components/discover/discover-explore-shortcuts.tsx`
- Modify: `apps/web/components/discover/discover-client.tsx`

**Interfaces:**
- `ExploreCollections` accepts `onSelect(id: DiscoverCollectionId)` and renders registry entries as accessible links/controls using `MediaRow`.
- `ActiveDiscoverCollection` accepts `{ collection: DiscoverCollection; onClear(): void }` and renders translated title, description, and an accessible clear button.

- [ ] **Step 1: Implement collection cards with the existing design language.** Use links or buttons with `focus-ring`, compact dark neutral surfaces, subtle borders, consistent radius/spacing, hover/focus transitions, and no filter-button styling. Use `href` generated from the current URL so collection selection preserves only applicable params.

- [ ] **Step 2: Implement the collection section.** Render a semantic `h2` with `discover.exploreCollections`, a horizontally scrollable `MediaRow`, and all registry entries in stable editorial order.

- [ ] **Step 3: Implement active collection context.** Render `h2`, translated description, and a clear action with `aria-label` from Tolgee. The clear callback must call the URL helper and remove only `collection`.

- [ ] **Step 4: Integrate the UI into `DiscoverClient`.** Replace the old shortcut import/render. Put the active context above the collection result grid; put Explore Collections after the personalized section and before generic downstream sections in the normal flow.

- [ ] **Step 5: Run web typecheck.**

Run: `pnpm --filter web exec tsc --noEmit`

Expected: PASS with typed collection IDs, callbacks, and existing component props.

### Task 5: Render the For You section without duplicating poster logic

**Files:**
- Create: `apps/web/components/discover/personalized-discover-section.tsx`
- Create: `apps/web/components/discover/personalized-discover-rail.tsx`
- Modify: `apps/web/components/discover/discover-client.tsx`
- Modify: `apps/web/lib/discover/section-ordering.ts` to place the new `personalized` and `collections` descriptors if the existing order builder remains the page’s section-order source
- Test: `apps/web/lib/tests/discover/discover-presentation.test.mjs`

**Interfaces:**
- `PersonalizedDiscoverSection` accepts `rails: PersonalizedDiscoverRail[]` and returns `null` for no rails.
- `PersonalizedDiscoverRail` renders each rail through existing `MediaSection`/`MediaRow` and uses `useMediaPoster` indirectly through the existing card implementation.

- [ ] **Step 1: Add/extend presentation tests.** Assert no section is produced for anonymous/empty rails, a seed title appears in the because-you-liked heading, and only selected rails render.

- [ ] **Step 2: Implement the section and rail components.** Use `discover.forYou` for the section heading, `discover.personalized.becauseYouLiked` for recommendation seeds, and `discover.personalized.moreFromDirectors` for director affinity; use the existing `home.moreWithPerson`/`home.moreFromPerson` defaults for actor/studio affinity. Reuse the existing title-card behavior instead of introducing a poster component.

- [ ] **Step 3: Place For You after broad/current sections and before Explore Collections.** Ensure popular/trending sections remain first and generic Top Rated/Upcoming/new-release sections remain after the editorial/personalized layer.

- [ ] **Step 4: Run focused presentation tests and typecheck.**

Run: `pnpm --filter web exec node --test lib/tests/discover/discover-presentation.test.mjs && pnpm --filter web exec tsc --noEmit`

Expected: PASS; anonymous/cold-start renders no For You heading or empty rail.

### Task 6: Add Tolgee keys and collection-aware localization coverage

**Files:**
- Modify: localization source through the existing Tolgee extraction/configuration workflow; do not create a legacy locale file
- Modify: affected Discover components to call `t` with default values
- Test: `apps/web/lib/tests/discover/discover-localization.test.mjs`

- [ ] **Step 1: Add default-value assertions for all new keys.** Cover `discover.forYou`, `discover.exploreCollections`, seven collection title/description pairs, four personalized labels, and the active collection clear label.

- [ ] **Step 2: Add the `t()` calls in components.** Keep query modules limited to key strings; do not embed translated display copy in collection criteria.

- [ ] **Step 3: Run the existing localization extraction/check command.**

Run: `pnpm --filter web test -- lib/tests/discover/discover-localization.test.mjs`

Expected: PASS and no legacy locale JSON is introduced.

### Task 7: Full verification and regression review

**Files:**
- Modify: only files identified by failing checks from Tasks 1–6

- [ ] **Step 1: Run all focused Discover tests.**

Run: `pnpm --filter web test -- lib/tests/discover`

Expected: PASS for collection parsing/query/URL behavior, personalization selection, section ordering, existing affinity/release behavior, and localization checks.

- [ ] **Step 2: Run web lint and typecheck.**

Run: `pnpm --filter web lint`

Run: `pnpm --filter web exec tsc --noEmit`

Expected: PASS without weakening existing rules or tests.

- [ ] **Step 3: Run the web production build.**

Run: `pnpm --filter web build`

Expected: PASS with `/discover`, `/discover?collection=hidden-gems`, and existing title routes compiling.

- [ ] **Step 4: Review the final diff and manually verify URL cases.** Check:

```txt
/discover
/discover?collection=hidden-gems
/discover?collection=hidden-gems&type=movie&rating=7
/discover?collection=whatever
```

Confirm collection clearing preserves `type`/`rating`, invalid IDs show normal Discover, Quick Watch does not issue a TV runtime query, and no anonymous For You section appears.

- [ ] **Step 5: Commit the implementation as one coherent feature change after checks pass.**

```bash
git add apps/web/lib/discover apps/web/components/discover apps/web/app/discover/page.tsx apps/web/lib/tests/discover locales packages/i18n docs/superpowers
git commit -m "feat(web): add discover collections and personalization"
```
