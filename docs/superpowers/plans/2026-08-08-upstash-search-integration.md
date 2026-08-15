# Upstash Search Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Kino search relevance by inserting Upstash Search as a server-only title and user search projection behind the existing gateway, while preserving the current grouped `SearchResult` contract, TMDb hydration, and graceful fallback behavior.

**Architecture:** Keep the current `/api/v1/search` gateway and grouped result presentation intact. Add a dedicated `apps/web/lib/search/upstash/` layer for client creation, document normalization, search providers, and indexers, then teach the gateway to merge Upstash and TMDb/user-provider results, dedupe them, and apply Kino-specific ranking before response serialization. Progressive indexing comes from bootstrap scripts plus opportunistic server-side refreshes when Kino already fetches title or user data.

**Tech Stack:** Next.js App Router, `@upstash/search`, TMDb REST API, server-only Node scripts, existing shared `@kino/core/search` contracts, Node test runner.

## Global Constraints

- Use `@upstash/search` and `client.index(...)` / `index.upsert(...)` / `index.search(...)` for Upstash Search.
- Never expose the Upstash write token to the client.
- Keep TMDb authoritative for movie and TV metadata.
- Keep Kino authoritative for app users.
- Preserve grouped search responses, `/search?q=...` URLs, keyboard navigation, localization, and people results.
- Create and use `kino-titles` and `kino-users` indexes initially.
- Do not index synchronously on every keystroke.
- Do not rebuild the UI around Upstash.
- Prefer graceful fallback over hard failure when Upstash is unavailable or misconfigured.
- Keep title and user indexing server-side.
- Use bounded bootstrap/backfill scripts for destructive or one-time jobs.
- Add deterministic tests for document shaping, ranking, dedupe, and fallback.

## Current Search Flow

- `apps/web/components/global-search.tsx` and `apps/web/app/search/page.tsx` both call the same-origin search gateway client.
- `apps/web/app/api/v1/search/route.ts` parses requests, rate-limits them, creates the gateway, and returns the shared response shape.
- `apps/web/lib/search/gateway.ts` currently orchestrates vector search, TMDb fallback, people expansion, dedupe, ranking, and localized presentation.
- `apps/web/lib/search/providers/tmdb.ts` is the authoritative TMDb search/hydration source.
- `packages/core/src/database.ts` and `apps/mobile/services/database.ts` are still the user search mutation/query surfaces.
- `apps/web/lib/search/presentation.ts` maps `SearchResponse` into the existing grouped `SearchResult` UI contract.

## Files / Modules To Modify

- `apps/web/lib/search/server-env.ts`
- `apps/web/package.json`
- `.env.example`
- `apps/web/lib/search/gateway.ts`
- `apps/web/app/api/v1/search/route.ts`
- `apps/web/lib/search/observability.ts`
- `apps/web/lib/server-tmdb.ts`
- `apps/web/components/global-search.tsx`
- `apps/web/app/search/page.tsx`
- `apps/web/components/auth/auth-panel.tsx`
- `apps/web/app/settings/page.tsx`
- `apps/web/components/profile/profile-view.tsx`
- `apps/mobile/services/database.ts`
- `apps/mobile/hooks/profile/useUserSearch.ts`
- `apps/mobile/app/(tabs)/search.tsx`

## New Upstash Modules

- `apps/web/lib/search/upstash/client.ts`
- `apps/web/lib/search/upstash/indexes.ts`
- `apps/web/lib/search/upstash/title-document.ts`
- `apps/web/lib/search/upstash/user-document.ts`
- `apps/web/lib/search/upstash/title-indexer.ts`
- `apps/web/lib/search/upstash/user-indexer.ts`
- `apps/web/lib/search/upstash/title-search-provider.ts`
- `apps/web/lib/search/upstash/user-search-provider.ts`
- `apps/web/lib/search/upstash/ranking.ts`
- `apps/web/lib/search/upstash/telemetry.ts`

## Index Schemas

- `kino-titles`
- `kino-users`

Title documents should normalize into a stable `id`, searchable `content`, and structured `metadata`. The `content` fields should include title text, original title, aliases, overview, genres, cast, creators, directors, and other TMDb-provided semantic text when available. The `metadata` block should carry `entityType`, `tmdbId`, `mediaType`, `year`, `popularity`, `voteAverage`, `voteCount`, `posterPath`, and `backdropPath`.

User documents should normalize into a stable `id`, searchable `content`, and structured `metadata`. The `content` fields should include `username`, `name`, and `bio`. The `metadata` block should carry `entityType`, `userId`, `username`, and `avatarUrl`.

## Sync Strategy

- Titles are indexed progressively from TMDb touchpoints Kino already hits during normal usage.
- Titles are bootstrapped in bounded batches from trending, popular, top-rated, and optionally now-playing/upcoming TMDb lists.
- Users are indexed whenever searchable profile data changes through the existing web/mobile mutation surfaces.
- Existing users get a one-time backfill script.
- Deletions remove the corresponding Upstash document.

## Fallback Strategy

- Upstash title search is primary when it returns useful results, but TMDb search remains a fallback source for fresh or missing titles.
- Upstash user search is primary, with the existing user database search as fallback if Upstash fails or is empty.
- People search stays on the existing TMDb path for now.
- The gateway must keep returning a successful search response when Upstash is down, misconfigured, or times out.

## Ranking Strategy

- Normalize query/title strings before exact or prefix comparisons.
- Boost exact normalized title matches strongly above semantic-only matches.
- Boost prefix matches meaningfully.
- Use TMDb popularity and vote count as tie-breakers and disambiguation signals.
- Keep user ranking separate from title ranking so exact usernames do not suppress strong title matches.
- Preserve existing group ordering and dedupe by `mediaType + tmdbId` for titles.

## Migration / Bootstrap Strategy

- Bootstrap the index from a configurable set of TMDb pages and sources rather than mirroring all of TMDb.
- Use a reusable server-only indexer so bootstrap, backfill, and runtime refreshes share the same normalization logic.
- Add scripts for bootstrap, backfill, targeted reindex, and optional dev-only clear/rebuild.
- Keep TMDb hydration in place so Upstash results can be rendered without per-result detail calls whenever possible.

## Testing Strategy

- Add deterministic tests for document normalization, indexer payloads, provider search normalization, merge/dedupe, ranking, and gateway fallback.
- Mock providers and TMDb; do not hit live services in tests.
- Add coverage for exact title beats semantic match, prefix boost, popularity tie-breaking, duplicate merge, TMDb fallback, Upstash error fallback, and exact username wins.
- Verify the production web build after the search flow is wired.

---

### Task 1: Upstash Search Foundation

**Files:**
- Create: `apps/web/lib/search/upstash/client.ts`
- Create: `apps/web/lib/search/upstash/indexes.ts`
- Create: `apps/web/lib/search/upstash/title-document.ts`
- Create: `apps/web/lib/search/upstash/user-document.ts`
- Modify: `apps/web/lib/search/server-env.ts`
- Modify: `apps/web/package.json`
- Modify: `.env.example`
- Test: `apps/web/lib/search/upstash/client.test.mjs`
- Test: `apps/web/lib/search/upstash/indexes.test.mjs`
- Test: `apps/web/lib/search/upstash/title-document.test.mjs`
- Test: `apps/web/lib/search/upstash/user-document.test.mjs`
- Test: `apps/web/lib/search/server-env.test.mjs`

**Interfaces:**
- Consumes: `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`.
- Consumes: `@upstash/search` and its `client.index(...)` API.
- Produces: `createUpstashSearchClient(...)`, `UPSTASH_TITLE_INDEX`, `UPSTASH_USER_INDEX`, `normalizeTitleDocument(...)`, `normalizeUserDocument(...)`, and `readUpstashSearchServerEnv(...)`.
- Produces: server-only Upstash Search config and document payloads that can be reused by indexers, bootstrap scripts, and gateway providers.

- [ ] **Step 1: Write the failing foundation tests**

Add tests that assert `readUpstashSearchServerEnv` accepts a fully populated HTTPS config, rejects partial/malformed values, and never falls back to public env names. Add title/user document tests that verify partial TMDb/user input still yields a valid document with `content` and `metadata`, and that absent optional fields are omitted rather than serialized as empty junk.

- [ ] **Step 2: Run the new tests to confirm RED**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/client.test.mjs lib/search/upstash/indexes.test.mjs lib/search/upstash/title-document.test.mjs lib/search/upstash/user-document.test.mjs lib/search/server-env.test.mjs`
Expected: failures for missing modules and missing Upstash Search helpers.

- [ ] **Step 3: Implement the client, index constants, and document normalizers**

Build a server-only Upstash client wrapper that uses the configured REST URL and token, plus small helpers for the `kino-titles` and `kino-users` index names. Normalize title and user documents so later indexers can accept partial upstream data without crashing or forcing full hydration.

- [ ] **Step 4: Re-run the foundation tests**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/client.test.mjs lib/search/upstash/indexes.test.mjs lib/search/upstash/title-document.test.mjs lib/search/upstash/user-document.test.mjs lib/search/server-env.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the foundation layer**

Commit message: `feat(search): add upstash search foundation`

---

### Task 2: Indexers, Bootstrap, and User Sync

**Files:**
- Create: `apps/web/lib/search/upstash/title-indexer.ts`
- Create: `apps/web/lib/search/upstash/user-indexer.ts`
- Create: `apps/web/scripts/search/bootstrap-titles.ts`
- Create: `apps/web/scripts/search/backfill-users.ts`
- Create: `apps/web/scripts/search/reindex-title.ts`
- Create: `apps/web/scripts/search/reindex-user.ts`
- Create: `apps/web/scripts/search/clear-indexes-dev.ts`
- Modify: `apps/web/lib/server-tmdb.ts`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/components/auth/auth-panel.tsx`
- Modify: `apps/web/components/profile/profile-view.tsx`
- Modify: `apps/mobile/services/database.ts`
- Test: `apps/web/lib/search/upstash/title-indexer.test.mjs`
- Test: `apps/web/lib/search/upstash/user-indexer.test.mjs`
- Test: `apps/web/scripts/search/bootstrap-titles.test.mjs`
- Test: `apps/web/scripts/search/backfill-users.test.mjs`

**Interfaces:**
- Consumes: `normalizeTitleDocument(...)`, `normalizeUserDocument(...)`, `createUpstashSearchClient(...)`, and the TMDb wrapper functions already used by Kino.
- Consumes: the existing profile mutation call sites in web and mobile.
- Produces: `createTitleIndexer(...)`, `createUserIndexer(...)`, `bootstrapTitleIndex(...)`, `backfillUserIndex(...)`, `reindexTitle(...)`, and `reindexUser(...)`.
- Produces: a single reusable server-side write path for Upstash indexing, plus bounded bootstrap/backfill scripts that can be run from `pnpm` scripts.

- [ ] **Step 1: Write the failing indexer and script tests**

Cover title upserts from partial TMDb records, user upserts from profile fields, document deletion on account removal, bootstrap pagination limits, and target reindex helpers. Include tests that prove the bootstrap job only touches the configured TMDb sources and pages and that the scripts call the shared indexer instead of building ad hoc payloads.

- [ ] **Step 2: Run the task tests to confirm RED**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/title-indexer.test.mjs lib/search/upstash/user-indexer.test.mjs scripts/search/bootstrap-titles.test.mjs scripts/search/backfill-users.test.mjs`
Expected: failures for missing indexers and script entrypoints.

- [ ] **Step 3: Implement the shared indexers and bootstrap/backfill scripts**

Make the title indexer accept TMDb search results, title detail payloads, and list results from trending/popular/top-rated bootstrap sources. Make the user indexer accept profile payloads from registration and profile updates. Wire the bootstrap script to trending, popular movies, popular TV, top rated movies, top rated TV, and optional now-playing/upcoming pages, all with bounded page counts and configurable limits.

- [ ] **Step 4: Wire progressive indexing into TMDb touchpoints**

Update `apps/web/lib/server-tmdb.ts` so the server-side TMDb wrapper can opportunistically hand title data to the shared title indexer after Kino already fetches useful title data. Update the web profile/auth mutation call sites and the mobile profile mutation service so a successful profile change also schedules the shared user indexer through the protected sync path from Task 4.

- [ ] **Step 5: Re-run the indexer and bootstrap tests**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/title-indexer.test.mjs lib/search/upstash/user-indexer.test.mjs scripts/search/bootstrap-titles.test.mjs scripts/search/backfill-users.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the indexing layer**

Commit message: `feat(search): add upstash indexing and sync scripts`

---

### Task 3: Upstash Search Providers and Gateway Ranking

**Files:**
- Create: `apps/web/lib/search/upstash/title-search-provider.ts`
- Create: `apps/web/lib/search/upstash/user-search-provider.ts`
- Create: `apps/web/lib/search/upstash/ranking.ts`
- Create: `apps/web/lib/search/upstash/telemetry.ts`
- Modify: `apps/web/lib/search/gateway.ts`
- Modify: `apps/web/app/api/v1/search/route.ts`
- Modify: `apps/web/lib/search/observability.ts`
- Modify: `apps/web/lib/search/providers/tmdb.ts`
- Test: `apps/web/lib/search/upstash/title-search-provider.test.mjs`
- Test: `apps/web/lib/search/upstash/user-search-provider.test.mjs`
- Test: `apps/web/lib/search/upstash/ranking.test.mjs`
- Test: `apps/web/lib/search/gateway.test.mjs`

**Interfaces:**
- Consumes: `createUpstashSearchClient(...)`, `createTitleIndexer(...)`, `createUserIndexer(...)`, and the existing TMDb search provider contract.
- Consumes: `SearchRequest`, `SearchResponse`, `SearchProviderResult`, `SearchProviderCandidate`, and the existing `toWebSearchGroups` contract.
- Produces: `createUpstashTitleSearchProvider(...)`, `createUpstashUserSearchProvider(...)`, `rankUpstashMergedResults(...)`, and gateway wiring that prefers Upstash when it is useful but still falls back to TMDb and the database provider.
- Produces: dev-only ranking telemetry that can show query, source, Upstash score, final score, exact/prefix boosts, and popularity boost without exposing those details to normal production responses.

- [ ] **Step 1: Write the failing provider and ranking tests**

Cover title result normalization, user result normalization, exact title outranking weak semantic matches, prefix boosts, high-popularity disambiguation, duplicate merging by `mediaType + tmdbId`, TMDb fallback when Upstash returns nothing, and TMDb fallback when Upstash throws. Add a separate user-ranking test where an exact `@username`-style match beats a semantically similar bio match.

- [ ] **Step 2: Run the provider tests to confirm RED**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/title-search-provider.test.mjs lib/search/upstash/user-search-provider.test.mjs lib/search/upstash/ranking.test.mjs lib/search/gateway.test.mjs`
Expected: failures for missing providers, missing ranking helper, or missing fallback wiring.

- [ ] **Step 3: Implement the Upstash title/user providers and ranking helper**

Implement the Upstash Search calls against `kino-titles` and `kino-users`, translate responses into the existing search candidate shape, and keep TMDb search and the existing database user search available as fallback sources. Put the Kino-specific boosts in one isolated ranking helper so title and user ranking remain deterministic and testable.

- [ ] **Step 4: Wire the providers into the gateway and route**

Extend the gateway so it queries Upstash first, queries TMDb or the user provider in parallel or fallback mode, merges results instead of concatenating them, dedupes identical titles, preserves locale and region, and keeps people search on the existing TMDb path. Keep the route handler and client-facing search response shape unchanged.

- [ ] **Step 5: Add dev-only ranking telemetry**

Emit structured ranking diagnostics only in development or when explicitly enabled, and keep them out of normal API responses. The debug output must be enough to inspect query, source, Upstash score, final score, and boost components without leaking raw provider secrets.

- [ ] **Step 6: Re-run the gateway and ranking tests**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/title-search-provider.test.mjs lib/search/upstash/user-search-provider.test.mjs lib/search/upstash/ranking.test.mjs lib/search/gateway.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit the gateway integration**

Commit message: `feat(search): route kino search through upstash`

---

### Task 4: User Sync Route, Consumer Wiring, and End-to-End Verification

**Files:**
- Create: `apps/web/app/api/v1/search/sync/user/route.ts`
- Create: `apps/web/lib/search/upstash/user-sync.ts`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/components/auth/auth-panel.tsx`
- Modify: `apps/web/components/profile/profile-view.tsx`
- Modify: `apps/mobile/services/database.ts`
- Modify: `apps/mobile/hooks/profile/useUserSearch.ts`
- Modify: `apps/mobile/app/(tabs)/search.tsx`
- Modify: `apps/web/package.json`
- Modify: `apps/web/lib/search/actual-route.test.mjs`
- Modify: `apps/web/lib/search/route-handler.test.mjs`
- Modify: `apps/web/lib/search/consumer.test.mjs`
- Test: `apps/web/app/api/v1/search/sync/user/route.test.mjs`
- Test: `apps/mobile/services/database.test.mjs`

**Interfaces:**
- Consumes: the user indexer from Task 2 and the protected caller identity from the existing auth flow.
- Consumes: the unchanged search UI contract on web and mobile.
- Produces: a protected user sync route for profile registration/update/delete events, plus the final dependency and script wiring in `apps/web/package.json`.
- Produces: end-to-end coverage proving the gateway still responds with the same grouped payloads and that user sync can run without exposing Upstash credentials to the client.

- [ ] **Step 1: Write the failing sync and integration tests**

Cover a protected user sync route that upserts the latest username/display name/bio/avatar document, deletes the document on account deletion, and rejects unauthenticated or mismatched callers. Extend the existing gateway and route tests to verify the `/api/v1/search` response shape, fallback behavior, and grouped results remain unchanged after the Upstash integration.

- [ ] **Step 2: Run the sync tests to confirm RED**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types app/api/v1/search/sync/user/route.test.mjs lib/search/route-handler.test.mjs lib/search/actual-route.test.mjs lib/search/consumer.test.mjs`
Expected: failures for missing sync route, missing auth checks, or missing integration wiring.

- [ ] **Step 3: Implement the protected user sync route and consumer updates**

Add the route that accepts the current profile payload, validates the caller, and calls the shared user indexer. Update the web settings/auth/profile mutation paths and the mobile profile service so successful mutations trigger the sync route, and update the app package manifest so the new search package dependency is installed and tested in the right package.

- [ ] **Step 4: Re-run the sync and integration tests**

Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types app/api/v1/search/sync/user/route.test.mjs lib/search/route-handler.test.mjs lib/search/actual-route.test.mjs lib/search/consumer.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the production verification suite**

Run:
`pnpm --filter @kino/web lint`
`pnpm --filter @kino/web typecheck`
`pnpm --filter @kino/web test`
`pnpm --filter @kino/web build`
If any task touches shared runtime code or route contracts outside the web app, run the corresponding package tests as well before marking the branch complete.

- [ ] **Step 6: Commit the end-to-end integration**

Commit message: `feat(search): complete upstash search integration`

## Coverage Check

- Current search flow: documented above and preserved in Task 3 and Task 4.
- Files/modules to modify: listed above with explicit task ownership.
- New Upstash modules: listed above and implemented in Tasks 1 to 4.
- Index schemas: Task 1 and the index schema section.
- Sync strategy: Task 2 and Task 4.
- Fallback strategy: Task 3 and Task 4.
- Ranking strategy: Task 3.
- Migration/bootstrap strategy: Task 2.
- Tests: spread across every task with deterministic Node test files and final package verification.

## Remaining Notes

- Do not remove the existing TMDb provider until the new path is proven end-to-end.
- Do not change the search UI into an Upstash-specific UI.
- Keep people results and localization behavior intact.
- Keep any debug ranking details out of normal production responses.
