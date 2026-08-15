# Upstash Redis Search Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Kino's unfinished standalone `@upstash/search` adapter with server-only Upstash Redis Search while preserving the existing search gateway, result contracts, localization, autocomplete, and UI behavior.

**Architecture:** Keep `/api/v1/search`, `createSearchGateway`, `@kino/core/search`, the existing TMDb presentation path, and all search components. Replace the current `@upstash/search` providers/indexers with one `@upstash/redis` JSON search index for titles, people, and public users. Redis supplies bounded lexical candidates; Kino's existing fusion/ranking/deduplication remains authoritative, and TMDb/Supabase continue as conditional fallbacks.

**Tech Stack:** Next.js App Router, `@upstash/redis`, Supabase, TMDb REST API, TanStack Query, existing `@kino/core/search` contracts, Node's built-in test runner with `--experimental-strip-types`, pnpm, Biome.

## Global Constraints

- Use `@upstash/redis`, not the standalone `@upstash/search` product.
- Use `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; never use `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` for Redis credentials.
- Create one `kino-search` index once with `existsOk: true`; never create indexes from a normal search request.
- Use JSON documents and key prefixes `kino:search:title:`, `kino:search:person:`, and `kino:search:user:`.
- Keep Redis-specific response types inside `apps/web/lib/search/upstash`; React consumes only the existing Kino search response types.
- Keep TMDb authoritative for media metadata and Supabase authoritative for persisted titles and public users.
- Do not replace `GlobalSearch`, add `@upstash/search-ui`, change result cards, or alter keyboard/animation behavior.
- Do not call `waitIndexing()` on production writes or every request; use it only for explicit setup/backfill integration verification.
- Preserve existing API validation, query limits, schema versions, React Query cancellation, debounce, caching, localization, grouping, routing, and full-search pagination.
- Preserve unrelated dirty-worktree changes and do not modify native/mobile files for this web-only migration.

---

## Task 1: Replace the standalone dependency and define Redis Search infrastructure

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Modify: `apps/web/lib/search/server-env.ts`
- Replace: `apps/web/lib/search/upstash/client.ts`
- Replace: `apps/web/lib/search/upstash/indexes.ts`
- Create: `apps/web/lib/search/upstash/schemas.ts`
- Test: `apps/web/lib/search/upstash/client.test.mjs`
- Test: `apps/web/lib/search/upstash/indexes.test.mjs`
- Test: `apps/web/lib/search/server-env.test.mjs`

**Interfaces:**
- Produces `RedisSearchClientConfig`, `createRedisSearchClient(config)`, `getTitleSearchIndex(redis)`, `getPersonSearchIndex(redis)`, `getUserSearchIndex(redis)`, and `setupRedisSearchIndexes(redis)`.
- Produces `TITLE_INDEX_NAME`, `PERSON_INDEX_NAME`, `USER_INDEX_NAME`, `TITLE_KEY_PREFIX`, `PERSON_KEY_PREFIX`, and `USER_KEY_PREFIX`.
- `readRedisServerEnv()` remains the canonical parser for `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; remove the old `UPSTASH_SEARCH_REST_*` path after all callers migrate.

- [ ] **Step 1: Write failing environment and setup tests.**

  Assert that a complete HTTPS URL/token pair is accepted, partial credentials and non-HTTPS URLs throw `SearchServerConfigurationError`, `NEXT_PUBLIC_UPSTASH_*` is ignored, and setup calls `createIndex` for the three exact index names with `existsOk: true`.

- [ ] **Step 2: Run the focused tests and verify RED.**

  Run:

  ```bash
  pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/client.test.mjs lib/search/upstash/indexes.test.mjs lib/search/server-env.test.mjs
  ```

  Expected: failures because the Redis client, schemas, and setup helpers are not implemented.

- [ ] **Step 3: Switch the package and implement the Redis client/index definitions.**

  Remove `@upstash/search` from `apps/web/package.json`, add the current `@upstash/redis` package, install with pnpm so `pnpm-lock.yaml` is updated, and replace the old client wrapper with `new Redis({ url, token })`. Define JSON schemas with `s.object(...)`; use `.noStem()` on title/name fields, `s.keyword()` or `.noTokenize()` on exact identifiers, and numeric fields for ranking values. Keep non-search display fields in the JSON document even when they are not schema-indexed.

- [ ] **Step 4: Update environment examples and rerun the focused tests.**

  Keep the existing rate-limiter variables documented once, add a single server-only Redis Search configuration block, and remove duplicate `UPSTASH_VECTOR_REST_*` lines from `.env.example` only where they are stale duplicates. Run the command from Step 2 and expect PASS.

- [ ] **Step 5: Run TypeScript for the changed infrastructure.**

  Run `pnpm --filter @kino/web exec tsc --noEmit`; fix only Redis integration type errors introduced by this task.

---

## Task 2: Build title, person, and public-user documents with localization aliases

**Files:**
- Replace: `apps/web/lib/search/upstash/title-document.ts`
- Replace: `apps/web/lib/search/upstash/user-document.ts`
- Create: `apps/web/lib/search/upstash/person-document.ts`
- Create: `apps/web/lib/search/upstash/localized-aliases.ts`
- Test: `apps/web/lib/search/upstash/title-document.test.mjs`
- Test: `apps/web/lib/search/upstash/user-document.test.mjs`
- Test: `apps/web/lib/search/upstash/person-document.test.mjs`
- Test: `apps/web/lib/search/upstash/localized-aliases.test.mjs`

**Interfaces:**
- `normalizeTitleDocument(input: TitleDocumentInput): TitleSearchDocument | null`
- `normalizePersonDocument(input: PersonDocumentInput): PersonSearchDocument | null`
- `normalizeUserDocument(input: UserDocumentInput): UserSearchDocument | null`
- `toSearchMediaType(type: MediaType | SearchMediaType): SearchMediaType`
- `mergeLocalizedTitleAliases(values): LocalizedTitleAliases`

- [ ] **Step 1: Write failing document tests.**

  Cover movie and series identity (`movie:238` versus `series:238`), omission of empty optional values, extraction from `PersistedTitle`/TMDb-like fields, person normalization, public-user-only fields, username normalization without `@`, and aliases for `en`, `pt`, `fr`, `it`, `no`, `es`, and `de`. Include a `pt-BR` alias and assert that it remains associated with the `pt` key.

- [ ] **Step 2: Run the document tests and verify RED.**

  Run:

  ```bash
  pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/title-document.test.mjs lib/search/upstash/user-document.test.mjs lib/search/upstash/person-document.test.mjs lib/search/upstash/localized-aliases.test.mjs
  ```

- [ ] **Step 3: Implement minimal normalizers.**

  Store JSON documents with stable IDs and fields shaped for the schemas. Use search-contract media types in Redis documents, preserve original title and aliases, retain TMDb poster paths rather than presentation URLs, and include only public user profile fields. Keep localized aliases as a finite object keyed from `KINO_LOCALES`; never invent a second locale registry.

- [ ] **Step 4: Rerun the tests and verify PASS.**

  Run the command from Step 2. Refactor only after the focused suite is green.

---

## Task 3: Add Redis document writes, deletes, and index setup/backfill scripts

**Files:**
- Replace: `apps/web/lib/search/upstash/title-indexer.ts`
- Replace: `apps/web/lib/search/upstash/user-indexer.ts`
- Create: `apps/web/lib/search/upstash/person-indexer.ts`
- Modify: `apps/web/scripts/upstash/shared.ts`
- Create: `apps/web/scripts/upstash/setup-search.ts`
- Create: `apps/web/scripts/upstash/backfill-titles.ts`
- Modify: `apps/web/scripts/upstash/backfill-users.ts`
- Modify: `apps/web/scripts/upstash/reindex-title.ts`
- Create: `apps/web/scripts/upstash/reindex-person.ts`
- Modify: `apps/web/scripts/upstash/reindex-user.ts`
- Modify: `apps/web/scripts/upstash/clear-search.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/lib/search/upstash/indexer.test.mjs`
- Test: `apps/web/scripts/upstash/shared.test.mjs`

**Interfaces:**
- `TitleIndexer.upsertDocument(document | documents): Promise<void>` and `deleteTitle(mediaType, tmdbId): Promise<void>`.
- `PersonIndexer.upsertDocument(document | documents): Promise<void>` and `deletePerson(tmdbId): Promise<void>`.
- `UserIndexer.upsertDocument(document | documents): Promise<void>` and `deleteUser(userId): Promise<void>`.
- Each indexer writes `redis.json.set(key, '$', document)` in bounded batches and logs only counts/errors.

- [ ] **Step 1: Write failing indexer tests.**

  Use a fake Redis client with `json.set`, `del`, and pipeline recording. Assert correct key prefixes, stable keys, batch boundaries, delete keys, and that one failed batch rejects the explicit indexing operation without altering the canonical data path.

- [ ] **Step 2: Run the indexer tests and verify RED.**

  Run `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/indexer.test.mjs` and confirm failure due to the missing Redis implementation.

- [ ] **Step 3: Implement batched JSON writes and deletes.**

  Use `redis.pipeline()` where the SDK supports it; otherwise use bounded `Promise.all` batches no larger than 100. Do not call `waitIndexing()` in indexers. Keep a reusable `withBestEffortIndexing` wrapper for runtime calls that logs a safe error and resolves without affecting the caller.

- [ ] **Step 4: Implement setup and safe backfill commands.**

  `setup-search.ts` loads env and calls `setupRedisSearchIndexes`. `backfill-titles.ts` pages through `titles` ordered by `updated_at`, maps canonical rows and optional `tmdb_data`, and prints `{ indexed, failed }` progress. `backfill-users.ts` continues paging `user_profiles` and indexes only public fields. `reindex-person.ts` uses TMDb person details. The clear script must explicitly drop only the three named search indexes when invoked, never delete the whole Redis database.

- [ ] **Step 5: Update package commands and rerun tests.**

  Add `upstash:setup-search` and `upstash:backfill-titles`; keep/update targeted reindex commands and remove any command that imports `@upstash/search`. Run the focused test suite and `pnpm --filter @kino/web exec tsc --noEmit`.

---

## Task 4: Implement Redis title/person/user query providers and deterministic ranking

**Files:**
- Replace: `apps/web/lib/search/upstash/title-search-provider.ts`
- Replace: `apps/web/lib/search/upstash/user-search-provider.ts`
- Replace: `apps/web/lib/search/upstash/ranking.ts`
- Create: `apps/web/lib/search/upstash/query-filters.ts`
- Test: `apps/web/lib/search/upstash/ranking.test.mjs`
- Create: `apps/web/lib/search/upstash/title-search-provider.test.mjs`
- Create: `apps/web/lib/search/upstash/user-search-provider.test.mjs`

**Interfaces:**
- `createRedisTitleSearchProvider(options): VectorSearchProvider` queries `kino-search` in parallel for title and people filters and returns the existing `SearchProviderResult` candidate union.
- `createRedisUserSearchProvider(options): UserSearchProvider` queries `kino-search` with the `user` entity filter and invokes the Supabase fallback only when Redis is unavailable or below the user sufficiency threshold.
- `scoreTitleSearchHit`, `scorePersonSearchHit`, and `scoreUserSearchHit` return existing Kino entities plus lexical/exact/prefix flags; no Redis response type leaks beyond this directory.

- [ ] **Step 1: Write failing ranking/provider tests.**

  Cover exact title over weak fuzzy, `godf`/`oppen` prefix matches, `godfahter` and `oppenhimer` typo matches, popularity not overriding a superior textual match, exact username over display-name fuzzy, person normalization, Redis/TMDb duplicate identity, and query construction containing `$smart`, `$fuzzy` prefix, `$should`, and `$boost`.

- [ ] **Step 2: Run the tests and verify RED.**

  Run:

  ```bash
  pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/ranking.test.mjs lib/search/upstash/title-search-provider.test.mjs lib/search/upstash/user-search-provider.test.mjs
  ```

- [ ] **Step 3: Implement title/person Redis queries.**

  Build bounded filters from the normalized query. Use `$should` clauses for canonical/original/localized title fields, `$smart` for normal matching, and `$fuzzy: { value, prefix: true, transpositionCostOne: true }` only for autocomplete/short typo-tolerant clauses. Query title and person indexes with `Promise.all`. Convert hits into `lexical` and `person` candidates with stable identities and safe display fields.

- [ ] **Step 4: Implement user-directory query behavior.**

  Query exact normalized username separately within the same filter structure or as a single `$should` query, then username-prefix/display-name-prefix clauses, then limited display-name fuzzy clauses. Do not index or search email. Merge duplicate Redis hits by user ID before returning.

- [ ] **Step 5: Implement deterministic post-ranking.**

  Normalize accents and punctuation with the existing Kino query normalization. Assign ordered textual match tiers before applying bounded logarithmic popularity/vote signals. Preserve `sourceId`, exact/prefix flags, and the existing `SearchProviderCandidate` shapes so `@kino/core/search` can fuse results unchanged.

- [ ] **Step 6: Rerun the focused tests and typecheck.**

  Run the command from Step 2 and `pnpm --filter @kino/web exec tsc --noEmit`; fix implementation errors, not assertions.

---

## Task 5: Integrate Redis as the primary gateway provider with conditional TMDb fallback

**Files:**
- Modify: `apps/web/lib/search/gateway.ts`
- Modify: `apps/web/app/api/v1/search/route.ts`
- Modify: `apps/web/lib/search/providers/vector.ts`
- Modify: `apps/web/lib/search/observability.ts`
- Modify: `apps/web/lib/search/upstash/title-indexer.ts`
- Modify: `apps/web/lib/search/upstash/person-indexer.ts`
- Modify: `apps/web/lib/search/providers/tmdb.ts`
- Test: `apps/web/lib/search/gateway.test.mjs`
- Test: `apps/web/lib/search/observability.test.mjs`

**Interfaces:**
- Keep `SearchGateway.search(request, signal): Promise<SearchResponse>` unchanged.
- Preserve the existing `vector?: VectorSearchProvider` dependency slot for compatibility, but inject the Redis indexed provider there and update its comments/types to describe indexed lexical search.
- Add optional person indexing to the gateway dependencies without changing the public route response.

- [ ] **Step 1: Write failing gateway tests.**

  Assert that strong Redis results avoid TMDb, one fewer result than the maximum does not automatically invoke TMDb, insufficient Redis results invoke TMDb, Redis failure invokes TMDb safely, TMDb result indexing failure does not fail the response, Redis/TMDb duplicates merge once, and movie/series same numeric IDs stay separate. Assert telemetry records Redis count, fallback state, TMDb count, merged count, and duration without secrets.

- [ ] **Step 2: Run the gateway tests and verify RED.**

  Run `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/gateway.test.mjs lib/search/observability.test.mjs` and confirm the old vector assumptions fail for the new cases.

- [ ] **Step 3: Replace route construction with Redis providers.**

  In `/api/v1/search`, read the canonical Redis env once, create Redis provider/indexer clients only when configured, keep Supabase user fallback and TMDb construction, and preserve rate limiting. Do not create indexes in this route. If Redis is unconfigured, construct the gateway with Redis providers absent so TMDb/Supabase still work.

- [ ] **Step 4: Update gateway sufficiency and fallback indexing.**

  Replace semantic-only sufficiency checks with a mode-aware indexed sufficiency predicate using candidate count plus exact/prefix/strong lexical evidence. Keep existing timeout/cancellation behavior. When TMDb supplements the result, call title/person indexers through best-effort asynchronous wrappers and preserve `fallback: 'supplemented'`/`'provider_unavailable'` semantics.

- [ ] **Step 5: Rerun the gateway tests and typecheck.**

  Run the command from Step 2 and `pnpm --filter @kino/web exec tsc --noEmit`; then run the existing web search test glob to catch contract regressions.

---

## Task 6: Connect title and user synchronization through server boundaries

**Files:**
- Replace: `apps/web/lib/search/upstash/user-sync.ts`
- Modify: `apps/web/lib/search/upstash/user-sync-client.ts`
- Modify: `apps/web/app/api/v1/search/sync-user/route.ts`
- Create: `apps/web/app/api/v1/search/sync-title/route.ts`
- Modify: `apps/web/lib/auth-profile-server.ts`
- Modify: `apps/web/lib/auth-profile.ts`
- Modify: `apps/web/hooks/title/use-title-data.ts`
- Create: `apps/web/lib/search/upstash/user-sync.test.mjs`
- Create: `apps/web/lib/search/sync-title-route.test.mjs`
- Test: `apps/web/lib/auth-profile.test.mjs`

**Interfaces:**
- `upsertUserSearchProfile(supabase, userId): Promise<void>` and `deleteUserSearchProfile(userId): Promise<void>` use the Redis user indexer.
- `POST /api/v1/search/sync-title` accepts `{ tmdbId: number, type: "movie" | "tv" }`, validates the body, fetches canonical TMDb details server-side, and performs best-effort title/person indexing.

- [ ] **Step 1: Write failing synchronization tests.**

  Assert profile upsert/delete uses Redis indexer keys and public fields, sync-title rejects invalid input, successful sync indexes the normalized title, and Redis failure returns a safe response or best-effort result without corrupting the canonical flow.

- [ ] **Step 2: Run the sync tests and verify RED.**

  Run `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/upstash/user-sync.test.mjs lib/search/sync-title-route.test.mjs lib/auth-profile.test.mjs`.

- [ ] **Step 3: Implement server-side user synchronization.**

  Replace old standalone-search calls with Redis user indexer calls. Keep the existing authenticated sync route and client helper; client code may request the route but must not import Redis modules or credentials. Preserve account creation/update/delete behavior.

- [ ] **Step 4: Implement title sync and connect the existing title persistence seam.**

  Add the authenticated/rate-limited server route that reads `TMDB_API_KEY`, loads details/credits/translations through existing TMDb conventions, normalizes a title/person document, and writes Redis best-effort. Call this endpoint after `db.getOrCreateTitle(details)` in the existing web title-data flow without blocking the canonical title query on Redis indexing.

- [ ] **Step 5: Rerun sync tests and inspect browser boundaries.**

  Run the command from Step 2, `pnpm --filter @kino/web exec tsc --noEmit`, and verify no client-import path reaches `@upstash/redis` or server credentials.

---

## Task 7: Preserve localized presentation, ghost completion, cancellation, and full search behavior

**Files:**
- Modify only if required: `apps/web/components/global-search.tsx`
- Modify only if required: `apps/web/lib/search/featured-title.ts`
- Modify only if required: `apps/web/app/search/page.tsx`
- Modify: `apps/web/lib/search/presentation.ts` only if Redis result entities require an existing-field mapping
- Test: `apps/web/lib/search/featured-title.test.mjs`
- Create: `apps/web/lib/search/localization.test.mjs`
- Test: `apps/web/lib/search/client.test.mjs`

**Interfaces:**
- Keep `getFeaturedTitleCompletion(query, result)` and `selectFeaturedTitleResult(...)` as the ghost-completion boundary.
- Keep the existing `SearchGatewayClient.search(input, signal)` cancellation contract.

- [ ] **Step 1: Write failing presentation tests.**

  Assert a literal prefix produces only the suffix ghost completion, a fuzzy-only correction produces no ghost completion, selected-locale display remains supplied by the existing presentation/TMDb path, and a newer query signal cancels the older request.

- [ ] **Step 2: Run the presentation tests and verify RED where behavior is missing.**

  Run `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/search/featured-title.test.mjs lib/search/localization.test.mjs lib/search/client.test.mjs`.

- [ ] **Step 3: Make the smallest mapping-only changes.**

  Do not redesign the component. If Redis entities omit a field expected by `toWebSearchGroups`, map it inside the server/provider layer. Only adjust the completion helper if a test proves fuzzy results can produce an invalid suffix. Preserve the 80 ms existing debounce and React Query placeholder/cancellation behavior.

- [ ] **Step 4: Rerun focused web search tests.**

  Run the command from Step 2 and the complete web search test glob. Confirm no UI files changed unless required by a failing contract test.

---

## Task 8: Verify scripts, quality gates, and final diff boundaries

**Files:**
- Modify only files already listed above if verification exposes implementation defects
- Test: existing repository suites and all new focused tests

- [ ] **Step 1: Run the complete web search test suite.**

  Run:

  ```bash
  pnpm --filter @kino/web test
  pnpm --filter @kino/core test
  ```

  Expected: PASS with no Redis credentials required.

- [ ] **Step 2: Run repository quality gates.**

  Run:

  ```bash
  pnpm biome check .
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build:web
  ```

  Fix only issues caused by this migration; do not modify unrelated native/Expo code to silence web checks.

- [ ] **Step 3: Verify configuration and scripts without secrets.**

  Confirm `.env.example` contains only blank `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` entries, package scripts expose setup/backfill/reindex commands, no source imports `@upstash/search`, and no `NEXT_PUBLIC_UPSTASH_*` or `EXPO_PUBLIC_UPSTASH_*` variable is referenced.

- [ ] **Step 4: Review the final diff against the initial dirty-worktree snapshot.**

  Use `git diff --stat`, `git diff --name-only`, and targeted diffs to ensure only the approved web search/env/package/docs files changed. Do not stage or revert unrelated user work.

- [ ] **Step 5: Report the handoff.**

  Summarize the architecture, changed files, indexes/prefixes, required environment variables, setup/backfill commands, synchronization points, TMDb fallback threshold, ranking behavior, tests and quality results, and any manual Upstash/Vercel setup still required.
