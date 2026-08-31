# Kino Local-First PWA Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repeat Kino PWA launches render previously known content immediately from an isolated, bounded IndexedDB/TanStack cache while preserving locale, auth, deployment, and title-data correctness.

**Architecture:** Keep the app shell mounted outside a context-keyed query boundary. The boundary key is `cache schema + user/anonymous + Kino language`; each key gets its own `QueryClient`, `PersistQueryClientProvider`, and IndexedDB namespace, so auth/locale transitions synchronously discard old observers before asynchronously restoring the new namespace. Persist only explicitly classified successful query families, keep the service worker limited to resource delivery, and separate `TitlePreview`, `TitleCore`, and `KinoTitleIdentity` so preview data never enters the complete-detail cache.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query 5 persistence APIs, native IndexedDB, Zustand, Supabase client, custom service worker, Node test runner, Biome, TypeScript, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-25-local-first-pwa-startup-design.md`

## Global Constraints

- The persisted IndexedDB namespace and the in-memory `QueryClient` are the same isolation boundary.
- Context isolation is synchronous; IndexedDB restoration is asynchronous.
- Persistence defaults to `none`.
- Unknown query families must never be persisted.
- A cache key that semantically represents complete title details must never expose partial preview data as if it were complete.
- The service worker and TanStack persistence have separate responsibilities.
- Private and user-specific APIs remain network-only at the service-worker level.
- Public title presentation must never wait for `db.getOrCreateTitle(...)`.
- Cleanup never runs on the startup critical path and never deletes the active namespace.
- The unrelated working-tree change in `apps/web/components/layout/app-shell.tsx` must remain untouched.
- Previously known content must render immediately even when it is stale; background freshness is secondary.

---

## File map

### New files

- `apps/web/lib/cache-context.ts` — canonical cache context input and namespace key serialization.
- `apps/web/lib/query-persistence-policy.ts` — opt-in query-family classification and dehydrate predicate.
- `apps/web/lib/query-cache-storage.ts` — IndexedDB adapter, TanStack persister, bounded persisted-client trimming, and non-blocking namespace pruning.
- `apps/web/components/query-context-boundary.tsx` — keyed QueryClient/persister lifecycle and old-context cleanup.
- `apps/web/lib/local-first-performance.ts` — development-only performance marks/measures.
- `apps/web/public/sw-policy.js` — browser-safe service-worker resource classification and cache-budget helpers.
- Focused `.test.mjs` files next to the modules above, plus title/service-worker/provider integration tests under `apps/web/lib/tests`.

### Existing files to modify

- `apps/web/package.json`, `pnpm-lock.yaml` — add TanStack persistence provider dependency.
- `apps/web/lib/query-client.ts` — centralize default query lifetimes and create a fresh client per context.
- `apps/web/app/providers.tsx`, `apps/web/app/layout.tsx` — remove the locale gate and place the query boundary inside the shell.
- `apps/web/stores/settings-store.ts`, locale tests — server-locale initial snapshot and asynchronous reconciliation.
- `apps/web/public/sw.js`, service-worker registration tests — resource-specific strategies and versioned cleanup.
- `apps/web/lib/title/title-queries.ts`, `apps/web/lib/title/title-prefetch.ts`, title tests — preview/detail contracts and compatible placeholder behavior.
- `apps/web/hooks/title/use-title-data.ts`, `apps/web/components/title/title-page.tsx`, title header/metadata consumers — core/identity split and progressive rendering.
- `apps/web/app/title/[id]/page.tsx` — pass server-fetched public `TitleCore` into the canonical client title query.
- `apps/web/hooks/title/use-media-poster.ts` and high-value title card/link consumers — shared preview seeding and bounded intent/visibility prefetch.
- Diary, activity, watchlist, and profile query consumers — retain cached data while stale queries refresh.

## Execution rules

Each task follows this cycle: write one focused failing test, run it and record the expected failure, implement the smallest behavior, rerun the focused test and the affected existing tests, then commit the task. Do not edit `app-shell.tsx`. Use `pnpm --filter @kino/web exec node --test --experimental-strip-types <test-file>` for focused web tests.

### Task 1: Add persistence dependency and explicit opt-in policy

**Files:**

- Modify: `apps/web/package.json`, `pnpm-lock.yaml`
- Create: `apps/web/lib/query-persistence-policy.ts`
- Test: `apps/web/lib/query-persistence-policy.test.mjs`

**Interfaces:**

- Produces:

  ```ts
  export type QueryPersistenceScope = 'public' | 'authenticated' | 'none'

  export interface QueryPersistencePolicy {
    persistence: QueryPersistenceScope
    localeAware: boolean
    staleTime: number
    gcTime: number
    maxQueries: number
  }

  export function getQueryPersistencePolicy(
    queryKey: readonly unknown[]
  ): QueryPersistencePolicy

  export function shouldDehydrateQuery(query: {
    queryKey: readonly unknown[]
    state: { status: string; data: unknown }
  }): boolean
  ```

- Consumes: `CACHE_SCHEMA_VERSION`, canonical title/profile/watchlist/activity keys, and existing cache policy constants.

- [ ] **Step 1: Write the failing allowlist tests.** Assert that canonical public title summaries/details, authenticated profile/watchlist/diary/activity keys, and explicitly approved title personal-state keys return non-`none` policies; assert that autocomplete, mutations, auth/session keys, errors, transient keys, and an unknown key return `persistence: 'none'`.

  ```js
  test('unknown query families default to no persistence', () => {
    assert.equal(getQueryPersistencePolicy(['new-feature', 'value']).persistence, 'none')
  })

  test('failed or unclassified queries cannot be dehydrated', () => {
    assert.equal(
      shouldDehydrateQuery({ queryKey: ['search-autocomplete', 'star'], state: { status: 'success', data: [] } }),
      false
    )
    assert.equal(
      shouldDehydrateQuery({ queryKey: ['v1', 'title', 'summary', 'movie', 238, 'pt-BR', 'BR', 'public'], state: { status: 'error', data: null } }),
      false
    )
  })
  ```

- [ ] **Step 2: Run the focused test and verify it fails because the policy module is missing.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/query-persistence-policy.test.mjs`

  Expected: module-not-found or missing-export failure.

- [ ] **Step 3: Add the dependency and implement the exact-query-family allowlist.** Add `@tanstack/react-query-persist-client` at the same TanStack Query 5 minor line already used by the app. Match canonical roots and legacy families by explicit shape, derive public/authenticated classification from the normalized scope segment, and return `none` for every unmatched key. Never implement the predicate as a broad exclusion rule.

- [ ] **Step 4: Run the focused tests and existing cache tests.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/query-persistence-policy.test.mjs ../../packages/core/src/cache/query-keys.test.mjs`

  Expected: all focused tests pass with no warnings.

- [ ] **Step 5: Commit the policy boundary.**

  ```bash
  git add apps/web/package.json pnpm-lock.yaml apps/web/lib/query-persistence-policy.ts apps/web/lib/query-persistence-policy.test.mjs
  git commit -m "feat(web): define opt-in query persistence policy"
  ```

### Task 2: Implement namespaced IndexedDB persistence and storage budgets

**Files:**

- Create: `apps/web/lib/cache-context.ts`
- Create: `apps/web/lib/query-cache-storage.ts`
- Create: `apps/web/lib/cache-context.test.mjs`
- Create: `apps/web/lib/query-cache-storage.test.mjs`

**Interfaces:**

- Produces:

  ```ts
  export interface CacheContext {
    schemaVersion: string
    userId: string | null
    language: string
  }

  export function createCacheContextKey(context: CacheContext): string

  export interface QueryCacheStorage {
    read(namespace: string): Promise<PersistedClient | null>
    write(namespace: string, client: PersistedClient): Promise<void>
    remove(namespace: string): Promise<void>
    list(): Promise<Array<{ namespace: string; savedAt: number }>>
  }

  export function createIndexedDbQueryCacheStorage(): QueryCacheStorage
  export function createQueryCachePersister(namespace: string, storage?: QueryCacheStorage): Persister
  export function trimPersistedClient(client: PersistedClient, maxQueries: number, maxBytes: number): PersistedClient
  export function pruneInactiveQueryCacheNamespaces(storage: QueryCacheStorage, options: {
    activeNamespace: string
    maxAge: number
    maxInactiveNamespaces: number
    now?: number
  }): Promise<string[]>
  ```

- Consumes: `PersistedClient`/`Persister` from TanStack persistence APIs, `CACHE_SCHEMA_VERSION`, and Task 1 policy limits.

- [ ] **Step 1: Write failing context and budget tests.** Assert canonical key differences for anonymous/user/language/schema, exact preservation of separate optimized-image-style keys in the storage model is not collapsed, trimming by newest `dataUpdatedAt`, max byte/query bounds, and pruning that never deletes `activeNamespace`.

  ```js
  test('cache context separates user and locale namespaces', () => {
    assert.notEqual(
      createCacheContextKey({ schemaVersion: 'v2', userId: 'user-a', language: 'pt' }),
      createCacheContextKey({ schemaVersion: 'v2', userId: 'user-b', language: 'pt' })
    )
  })

  test('namespace pruning preserves the active namespace', async () => {
    const records = new Map([
      ['v2:user-a:pt', { namespace: 'v2:user-a:pt', savedAt: 9_900 }],
      ['v2:user-b:en', { namespace: 'v2:user-b:en', savedAt: 1_000 }],
    ])
    const storage = {
      read: async (namespace) => records.get(namespace)?.client ?? null,
      write: async (namespace, client) => records.set(namespace, { namespace, client, savedAt: 10_000 }),
      remove: async (namespace) => records.delete(namespace),
      list: async () => [...records.values()],
    }
    const removed = await pruneInactiveQueryCacheNamespaces(storage, {
      activeNamespace: 'v2:user-a:pt', maxAge: 7 * 24 * 60 * 60 * 1000, maxInactiveNamespaces: 1, now: 10_000,
    })
    assert.equal(removed.includes('v2:user-a:pt'), false)
  })
  ```

- [ ] **Step 2: Run the focused tests and verify the missing interfaces fail.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/cache-context.test.mjs lib/query-cache-storage.test.mjs`

  Expected: missing-module or missing-export failures.

- [ ] **Step 3: Implement the context key and fake-storage-friendly persister.** Use a versioned IndexedDB database/store with one record per namespace. Normalize language and user identifiers before serialization. Store the full namespace key in each record so cleanup can distinguish schema, user, and locale without parsing unsafe substrings.

- [ ] **Step 4: Implement bounded persisted-client trimming.** Drop mutations, retain only successful query entries supplied by TanStack dehydration, sort excess query entries by `dataUpdatedAt`, enforce `MAX_PERSISTED_QUERY_COUNT = 250` and `MAX_PERSISTED_CACHE_BYTES = 5 * 1024 * 1024`, and return a valid `PersistedClient` even when JSON serialization fails for a value.

- [ ] **Step 5: Implement opportunistic inactive-namespace pruning.** Remove records older than seven days and then remove the oldest inactive records above four retained inactive namespaces. Never remove the active namespace. Expose scheduling separately so the provider can call it through `requestIdleCallback`/`setTimeout` after restoration.

- [ ] **Step 6: Run focused tests, including a new `QueryClient` restore round trip.** Persist one successful title query with one persister, create a second `QueryClient`, restore it through the same namespace, and assert the data and `dataUpdatedAt` survive.

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/cache-context.test.mjs lib/query-cache-storage.test.mjs lib/query-persistence-policy.test.mjs`

- [ ] **Step 7: Commit the storage layer.**

  ```bash
  git add apps/web/lib/cache-context.ts apps/web/lib/cache-context.test.mjs apps/web/lib/query-cache-storage.ts apps/web/lib/query-cache-storage.test.mjs
  git commit -m "feat(web): add bounded namespaced query persistence"
  ```

### Task 3: Add the keyed QueryClient boundary and remove the locale startup gate

**Files:**

- Create: `apps/web/components/query-context-boundary.tsx`
- Modify: `apps/web/lib/query-client.ts`
- Modify: `apps/web/app/providers.tsx`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/stores/settings-store.ts`
- Modify: `apps/web/lib/localization/locale-readiness.ts` only if the initial-ready state needs a small pure helper
- Modify: `apps/web/lib/tests/localization/locale-readiness.test.mjs`
- Create: `apps/web/lib/tests/query-context-boundary.test.mjs`

**Interfaces:**

- Produces:

  ```tsx
  export function QueryContextBoundary({ children }: { children: ReactNode }): JSX.Element
  ```

- Consumes: `createCacheContextKey`, `createQueryCachePersister`, `PersistQueryClientProvider`, `useAuthStore`, `useSettingsStore`, `shouldDehydrateQuery`, and the existing `createQueryClient`.

- [ ] **Step 1: Write failing source/behavior tests.** Assert that `providers.tsx` no longer imports `HomeSkeleton`/`useRouter`, that the root tree renders children without checking `localeStatus === 'resolving'`, that the boundary key contains schema/user/language, and that changing either user or language creates a different boundary context. Add a fake lifecycle test proving old observers are disposed before the new context’s client is exposed.

  ```js
  test('startup provider does not gate children on locale readiness', () => {
    const source = readFileSync(providersUrl, 'utf8')
    assert.doesNotMatch(source, /HomeSkeleton/)
    assert.doesNotMatch(source, /router\.refresh\(\)/)
  })

  test('user and language changes produce distinct query contexts', () => {
    assert.notEqual(createCacheContextKey({ schemaVersion: 'v2', userId: 'a', language: 'pt' }), createCacheContextKey({ schemaVersion: 'v2', userId: 'b', language: 'pt' }))
    assert.notEqual(createCacheContextKey({ schemaVersion: 'v2', userId: 'a', language: 'pt' }), createCacheContextKey({ schemaVersion: 'v2', userId: 'a', language: 'en' }))
  })
  ```

- [ ] **Step 2: Run the focused tests and verify they fail against the current provider.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/tests/query-context-boundary.test.mjs lib/tests/localization/locale-readiness.test.mjs`

  Expected: failures for the existing `HomeSkeleton` gate, router refresh, and missing keyed boundary.

- [ ] **Step 3: Make settings start from the server locale without blocking.** Initialize the browser store from the validated `document.documentElement.lang` snapshot (with `en` fallback), set the initial readiness state to usable, and keep `hydrateLanguage()` asynchronous. If persisted storage resolves to another supported language, update the store/cookie/document language after first render without a router refresh. Preserve Tolgee locale readiness and the existing error metadata.

- [ ] **Step 4: Implement the keyed boundary.** The outer boundary derives `CacheContext` from the current auth user/language and renders an inner component with `key={contextKey}`. The inner component creates its own `QueryClient` and persister once, wraps the route subtree with `PersistQueryClientProvider`, uses `shouldDehydrateQuery`, `maxAge = 7 days`, and the cache buster, and cancels/clears its client on unmount. Authenticated old namespaces are removed on logout/user switch; public anonymous namespaces are retained. The shell remains outside this boundary in `app/layout.tsx`.

- [ ] **Step 5: Keep restoration asynchronous and isolated.** Use TanStack’s provider restoration lifecycle so the new observer subtree can never query the old client. Do not render a root `HomeSkeleton`; keep shell/navigation mounted, let route components decide whether genuinely unknown data needs a fallback, and schedule namespace pruning after the provider is usable.

- [ ] **Step 6: Add development-only timing marks.** Mark provider initialization, context switch, restore completion, cached-content availability, and background refresh start through `local-first-performance.ts`; the helper must be a no-op in production and when `performance.mark` is unavailable.

- [ ] **Step 7: Run locale/provider tests and typecheck the web app.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/tests/query-context-boundary.test.mjs lib/tests/localization/locale-readiness.test.mjs`; then `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`.

- [ ] **Step 8: Commit the startup boundary.**

  ```bash
  git add apps/web/components/query-context-boundary.tsx apps/web/lib/local-first-performance.ts apps/web/app/providers.tsx apps/web/app/layout.tsx apps/web/lib/query-client.ts apps/web/stores/settings-store.ts apps/web/lib/localization/locale-readiness.ts apps/web/lib/tests/query-context-boundary.test.mjs apps/web/lib/tests/localization/locale-readiness.test.mjs
  git commit -m "feat(web): switch startup to isolated local-first query contexts"
  ```

### Task 4: Replace blanket service-worker caching with bounded resource strategies

**Files:**

- Create: `apps/web/public/sw-policy.js`
- Modify: `apps/web/public/sw.js`
- Modify: `apps/web/lib/tests/service-worker-register.test.mjs`
- Create: `apps/web/lib/tests/service-worker-policy.test.mjs`

**Interfaces:**

- Produces browser-global `self.KinoSwPolicy` functions:

  ```js
  isImmutableAsset(request, origin)
  isApprovedImage(request, origin)
  isPrivateOrApiRequest(request, origin)
  shouldCacheResponse(response)
  shouldPruneImageCache(cacheKeys, maxEntries)
  ```

- Consumes: same-origin URL parsing, explicit approved image origins, and the service-worker cache names.

- [ ] **Step 1: Write failing strategy tests.** Assert cache-first classification for `/_next/static/*`, fonts, icons, and safe static assets; stale-while-revalidate classification for same-origin `/_next/image` and explicitly approved image origins; network-only classification for `/api/*`, Supabase/auth requests, and unknown resources; non-OK responses are rejected; and three distinct `/_next/image?...&w=342`, `w=500`, and `w=780` keys count as three entries.

- [ ] **Step 2: Run the policy tests and confirm the current service worker fails them.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/tests/service-worker-policy.test.mjs`

  Expected: missing policy module or assertions showing the current one-cache network-first behavior.

- [ ] **Step 3: Implement `sw-policy.js` and update `sw.js`.** Use versioned `kino-shell-v2`, `kino-assets-v2`, and `kino-images-v2` caches. Use cache-first for immutable assets, stale-while-revalidate for approved images, network-only for API/private data, and network-first navigation with cached `/` fallback. Cache only `response.ok` responses. Do not cache successful HTML navigations indefinitely.

- [ ] **Step 4: Add bounded image pruning outside startup.** Limit the image cache to 120 entries, prune oldest Cache API keys during activation and after image fetches through `event.waitUntil`, and treat each full request URL as a distinct entry. Do not await pruning before returning the primary response.

- [ ] **Step 5: Preserve development cleanup and test the full service-worker contract.** Extend the existing registration tests for `updateViaCache: 'none'`, versioned cache names, old `kino-*` cleanup only, no API caching, offline navigation fallback, and non-OK response exclusion.

- [ ] **Step 6: Commit the service-worker slice.**

  ```bash
  git add apps/web/public/sw-policy.js apps/web/public/sw.js apps/web/lib/tests/service-worker-register.test.mjs apps/web/lib/tests/service-worker-policy.test.mjs
  git commit -m "feat(web): specialize service worker resource caching"
  ```

### Task 5: Enforce TitlePreview/TitleCore cache semantics

**Files:**

- Modify: `apps/web/lib/title/title-queries.ts`
- Modify: `apps/web/lib/title/title-prefetch.ts`
- Modify: `apps/web/lib/title/title-prefetch.test.mjs`
- Create: `apps/web/lib/title/title-data-contract.test.mjs`

**Interfaces:**

- Produces:

  ```ts
  export interface TitlePreview {
    completeness: 'preview'
    backdropPath: string | null
    id: number
    mediaType: 'movie' | 'tv'
    posterPath: string | null
    title: string
    year: number | null
  }

  export interface TitleCore extends Omit<TitleDetails, 'averageRating' | 'ratingCount'> {
    completeness: 'core'
    averageRating: number
    ratingCount: number
  }

  export interface TitleDetailPlaceholder extends TitleDetails {
    completeness: 'preview'
  }

  export function toTitleDetailPlaceholder(preview: TitlePreview): TitleDetailPlaceholder
  export function seedTitlePreview(queryClient: QueryClient, context: LocalizedTitleQueryContext, preview: TitlePreview): void
  export function isTitleCore(value: TitleCore | TitleDetailPlaceholder): value is TitleCore
  ```

- Consumes: canonical `titleQueryKeys.summary` and `.details`; summary remains the only cache location for `TitlePreview`.

- [ ] **Step 1: Write failing semantic tests.** Seed a preview, assert the canonical summary query contains `completeness: 'preview'`, assert the canonical detail query is still empty, assert detail options expose an explicitly marked placeholder without writing it to the detail cache, and assert a successful fetch replaces the placeholder with `completeness: 'core'`.

  ```js
  test('preview seeding never writes partial data to the full-detail cache', () => {
    const client = new QueryClient()
    seedTitlePreview(client, context, preview)
    assert.equal(client.getQueryData(titleQueryKeys.canonical(context).details), undefined)
    assert.equal(client.getQueryData(titleQueryKeys.canonical(context).summary).completeness, 'preview')
  })
  ```

- [ ] **Step 2: Run the title tests and verify the current helpers fail the invariant.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/title/title-prefetch.test.mjs lib/title/title-data-contract.test.mjs`

  Expected: current summary shape lacks the discriminant/helper and the new detail-cache assertion fails if a detail seed is attempted.

- [ ] **Step 3: Implement the discriminated contracts.** Keep `titleQueryKeys.summary(...)` and `titleQueryKeys.details(...)` exactly canonical. `titleDetailsQueryOptions()` reads summary data only through `placeholderData`, converts it with `toTitleDetailPlaceholder`, and never calls `setQueryData` for the detail key. Mark placeholders so the persistence predicate excludes them if a future caller attempts to dehydrate them.

- [ ] **Step 4: Update prefetch helpers and tests.** Keep summary prefetch bounded at four concurrent tasks; allow only summary data to be seeded from cards. Full-detail prefetch remains navigation-intent-only and returns complete `TitleCore` data.

- [ ] **Step 5: Run all title tests and commit.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/title/title-prefetch.test.mjs lib/title/title-data-contract.test.mjs`

  ```bash
  git add apps/web/lib/title/title-queries.ts apps/web/lib/title/title-prefetch.ts apps/web/lib/title/title-prefetch.test.mjs apps/web/lib/title/title-data-contract.test.mjs
  git commit -m "feat(web): separate title preview and core cache contracts"
  ```

### Task 6: Split title public core from Kino identity and server-hydrate core data

**Files:**

- Modify: `apps/web/hooks/title/use-title-data.ts`
- Modify: `apps/web/components/title/title-page.tsx`
- Modify: `apps/web/components/title/title-header.tsx`
- Modify: `apps/web/components/title/title-metadata.tsx` only where a preview guard is required
- Modify: `apps/web/components/title/title-sidebar.tsx` only where full-core data is required
- Modify: `apps/web/app/title/[id]/page.tsx`
- Create: `apps/web/lib/title/title-core.ts` for serializable server/client normalization if needed
- Create: `apps/web/lib/tests/title-progressive-rendering.test.mjs`

**Interfaces:**

- Produces from `useTitleData()`:

  ```ts
  {
    titleQuery: UseQueryResult<TitleCore | TitleDetailPlaceholder>
    title: (TitleCore | TitleDetailPlaceholder) | undefined
    titleCore: TitleCore | undefined
    titleIdentityQuery: UseQueryResult<{ id: string } | null>
    currentProfileQuery: UseQueryResult<UserProfile | null>
    userDataQuery: UseQueryResult<TitleUserData | undefined>
    statsQuery: UseQueryResult<TitleRatingStats | undefined>
    nowPlayingQuery: UseQueryResult<TMDbTitle[]>
    contextQuery: UseQueryResult<TitleContextData>
  }

  type TitleUserData = {
    userRating: UserRating | null
    lastWatch: WatchDiaryEntry | null
    isWatchlisted: boolean
  }
  ```

- `TitlePage` accepts `initialCore?: TitleCore` and uses the canonical detail query key. `titleIdentityQuery` is enabled only for an authenticated viewer with loaded core data; `getOrCreateTitle()` is called only inside that identity query.

- [ ] **Step 1: Write failing tests for the split.** Assert that the title metadata query source does not call `db.getOrCreateTitle`, that identity is a separate query, that a preview/core title can render the critical presentation without identity data, and that personal query enablement depends on the identity ID rather than title metadata loading.

- [ ] **Step 2: Run the progressive-title tests and verify the current hook fails.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/tests/title-progressive-rendering.test.mjs`

  Expected: source assertions find `getOrCreateTitle()` inside the current title metadata query and no separate identity query.

- [ ] **Step 3: Refactor `useTitleData`.** Use canonical localized title detail options with a TMDb-only fetcher that returns `TitleCore` with `id: ANON_TITLE_ID`, `completeness: 'core'`, and public metadata. Add `initialData`/`initialDataUpdatedAt` only for the exact canonical detail key. Resolve `{ id }` independently through `db.getOrCreateTitle()` when the viewer is authenticated. Merge the resolved ID into the view model without mutating the core cache. Make personal state, title stats, actions, and season-specific queries depend on the identity query’s ID.

- [ ] **Step 4: Update the title page for progressive layers.** Treat `TitleDetailPlaceholder` as usable critical data. Render header/basic metadata immediately; render synopsis and full metadata only when available; keep personal actions disabled or auth-gated until identity is ready; let community stats/context/recommendations keep their own loading states. Replace the single `titleQuery.isLoading -> TitleSkeleton` gate with `!titleQuery.data` as the unknown-data condition.

- [ ] **Step 5: Pass server-fetched public core data through the route.** Keep `getTitleSeoData()` server-side for cold title requests, normalize it to the canonical `TitleCore` shape, and pass it as `initialCore` to `TitlePage`. Do not include session, profile, ratings, watchlist, or diary data in the server payload. Verify the client uses the same canonical key rather than a second initial-data cache.

- [ ] **Step 6: Run title tests and typecheck.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/tests/title-progressive-rendering.test.mjs lib/title/title-prefetch.test.mjs`; then `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`.

- [ ] **Step 7: Commit the title progressive layer.**

  ```bash
  git add apps/web/hooks/title/use-title-data.ts apps/web/components/title/title-page.tsx apps/web/components/title/title-header.tsx apps/web/components/title/title-metadata.tsx apps/web/components/title/title-sidebar.tsx apps/web/app/title/[id]/page.tsx apps/web/lib/title/title-core.ts apps/web/lib/tests/title-progressive-rendering.test.mjs
  git commit -m "feat(web): render title core independently from Kino identity"
  ```

### Task 7: Wire preview seeding and bounded navigation prefetch

**Files:**

- Modify: `apps/web/hooks/title/use-media-poster.ts`
- Modify: `apps/web/lib/title/title-prefetch.ts`
- Create: `apps/web/hooks/title/use-title-preview-prefetch.ts`
- Create: `apps/web/hooks/title/use-title-preview-prefetch.test.mjs`
- Modify: high-value title-link consumers: `apps/web/components/media/media-section.tsx`, `apps/web/components/discover/discover-updates-section.tsx`, `apps/web/components/discover/discover-collection-results.tsx`, `apps/web/components/title/title-context.tsx`, `apps/web/components/search/featured-search-result.tsx`, `apps/web/components/search/global-search.tsx`, `apps/web/app/search/page.tsx`, `apps/web/app/diary/page.tsx`, `apps/web/app/activity/page.tsx`, `apps/web/app/watchlists/[id]/page.tsx`, `apps/web/app/watchlists/shared/[code]/page.tsx`, `apps/web/components/profile/profile-movie-shelf.tsx`, `apps/web/components/profile/profile-series-shelf.tsx`
- Modify: `apps/web/lib/title/title-prefetch.test.mjs`

**Interfaces:**

- Produces:

  ```ts
  export function toTitlePreview(item: TMDbTitle, language: KinoLanguage): {
    context: LocalizedTitleQueryContext
    preview: TitlePreview
  }

  export function useTitlePreviewPrefetch(item: TMDbTitle, options?: {
    enabled?: boolean
    prefetchOnVisible?: boolean
  }): {
    href: string
    prefetch: () => void
    ref: (node: HTMLAnchorElement | null) => void
  }
  ```

- [ ] **Step 1: Write failing preview/prefetch tests.** Assert all title preview objects normalize language/region/media type, summary seeding uses the canonical summary key, route links remain the existing `titlePath`, focus/touch/pointer intent calls the bounded summary prefetch, and visibility prefetch stops after the configured first-N budget.

- [ ] **Step 2: Run the focused tests and verify the current hook lacks the shared contract.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types hooks/title/use-title-preview-prefetch.test.mjs lib/title/title-prefetch.test.mjs`

  Expected: missing module/export or assertions showing the current hook does not expose a visibility ref/shared `TitlePreview` contract.

- [ ] **Step 3: Implement the shared hook.** Replace the local region map with `getLocale/getRegion`, call `seedTitlePreview()` only, use existing four-request concurrency, honor `navigator.connection.saveData`/effective connection where available, and avoid more than six visible cards per route unless there is explicit user intent.

- [ ] **Step 4: Update card/link entry points.** Preserve existing visuals and hrefs. Add the hook’s `ref`/intent handlers to Discover, search, watchlists, profile, activity, diary, and recommendation links. Do not prefetch reviews/providers/trailers/seasons/recommendations for every card. Keep Next `Link` route prefetch enabled for route code.

- [ ] **Step 5: Run all affected tests and commit.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types hooks/title/use-title-preview-prefetch.test.mjs lib/title/title-prefetch.test.mjs lib/tests/discover/discover-presentation.test.mjs`

  ```bash
  git add apps/web/hooks/title/use-media-poster.ts apps/web/hooks/title/use-title-preview-prefetch.ts apps/web/hooks/title/use-title-preview-prefetch.test.mjs apps/web/lib/title/title-prefetch.ts apps/web/lib/title/title-prefetch.test.mjs apps/web/components/media/media-section.tsx apps/web/components/discover/discover-updates-section.tsx apps/web/components/discover/discover-collection-results.tsx apps/web/components/title/title-context.tsx apps/web/components/search/featured-search-result.tsx apps/web/components/search/global-search.tsx apps/web/app/search/page.tsx apps/web/app/diary/page.tsx apps/web/app/activity/page.tsx apps/web/app/watchlists/[id]/page.tsx apps/web/app/watchlists/shared/[code]/page.tsx apps/web/components/profile/profile-movie-shelf.tsx apps/web/components/profile/profile-series-shelf.tsx
  git commit -m "feat(web): seed title previews before navigation"
  ```

### Task 8: Make existing heavy routes cached-data-first

**Files:**

- Modify: `apps/web/app/diary/page.tsx`
- Modify: `apps/web/app/activity/page.tsx`
- Modify: `apps/web/app/watchlists/page.tsx`
- Modify: `apps/web/app/watchlists/[id]/page.tsx`
- Modify: `apps/web/app/watchlists/shared/[code]/page.tsx`
- Modify: `apps/web/components/profile/profile-view.tsx`
- Modify: `apps/web/components/profile/collections/profile-collection-page.tsx`
- Modify: `apps/web/hooks/activity/use-activity-feed.ts`
- Modify: existing profile/watchlist query option consumers where direct query policies are still missing
- Create: `apps/web/lib/tests/cached-data-first-rendering.test.mjs`

**Interfaces:**

- Produces a shared pure helper in `apps/web/lib/cached-data-first.ts`:

  ```ts
  export function shouldShowRouteSkeleton(input: {
    isPending: boolean
    hasData: boolean
  }): boolean
  ```

- [ ] **Step 1: Write failing tests.** Assert a route skeleton appears only when a query is pending and has no data; stale or restored data must return `false`. Assert localized-title skeletons are suppressed when the corresponding list already has known title data.

- [ ] **Step 2: Run the focused test and verify current route gates fail it.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/tests/cached-data-first-rendering.test.mjs`

  Expected: missing helper or current route behavior returns a skeleton for any pending query.

- [ ] **Step 3: Implement the helper and replace full-page pending checks.** Use `query.isPending && !query.data` (or the helper) for diary/activity/watchlists/profile sections. Keep error states and unauthenticated gates unchanged. Preserve existing route-level skeletons for genuinely unknown data.

- [ ] **Step 4: Centralize explicit query options where direct queries are persisted.** Apply the approved stale/GC policies to diary, activity, watchlist, profile, title identity, title personal state, title stats, and title context. Make any unclassified query explicitly `persistence: 'none'`; do not broaden the persistence predicate.

- [ ] **Step 5: Defer only demonstrably expensive secondary work.** Keep primary profile/collection/watchlist content mounted first, conditionally mount below-the-fold desktop-only sections where their query ownership makes this safe, and avoid user-agent forks or changes to shared data contracts. Discover remains server-first unless a client query contract is introduced explicitly.

- [ ] **Step 6: Run route tests and typecheck.**

  Run: `pnpm --filter @kino/web exec node --test --experimental-strip-types lib/tests/cached-data-first-rendering.test.mjs lib/tests/profile/profile-progressive-state.test.mjs lib/tests/profile/profile-query-options.test.mjs lib/tests/discover/discover-feed-queries.test.mjs`; then `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`.

- [ ] **Step 7: Commit the cached-data-first route behavior.**

  ```bash
  git add apps/web/lib/cached-data-first.ts apps/web/lib/tests/cached-data-first-rendering.test.mjs apps/web/app/diary/page.tsx apps/web/app/activity/page.tsx apps/web/app/watchlists/page.tsx apps/web/app/watchlists/[id]/page.tsx apps/web/app/watchlists/shared/[code]/page.tsx apps/web/components/profile/profile-view.tsx apps/web/components/profile/collections/profile-collection-page.tsx apps/web/hooks/activity/use-activity-feed.ts
  git commit -m "feat(web): keep known route data visible during refresh"
  ```

### Task 9: Add end-to-end contract tests and run the full quality workflow

**Files:**

- Modify/add focused tests under `apps/web/lib/tests`, `apps/web/lib/title`, and `apps/web/hooks/title` as required by Tasks 1–8.
- Create: `apps/web/lib/tests/local-first-flow.test.mjs` for pure lifecycle sequencing and persistence exclusions.
- Do not modify: `apps/web/components/layout/app-shell.tsx`.

**Interfaces:**

- The test suite consumes the production helpers from Tasks 1–8; it must not duplicate production cache-key or namespace logic in test-only helpers.

- [ ] **Step 1: Add lifecycle regression coverage.** Cover restore into a new `QueryClient`, schema buster rejection, user isolation, logout clearing persisted and in-memory user state, locale change remount, no old-context observer survival, async restore not exposing old data, and unknown-family `none` default.

- [ ] **Step 2: Add storage/service-worker regression coverage.** Cover active namespace preservation, inactive pruning after the app is usable, cache budget trimming, cache-first assets, stale-while-revalidate images, network-only private APIs, offline navigation fallback, non-OK exclusion, and separate optimized-image variants.

- [ ] **Step 3: Add title regression coverage.** Cover summary-only preview seeding, no partial detail cache entry, preview placeholder replacement by core, title public presentation before identity, server initial core using the canonical detail key, and navigation seeding from each high-value card family.

- [ ] **Step 4: Run the complete web workflow from a clean dependency state.**

  ```bash
  pnpm biome
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build:web
  ```

  Expected: exit code 0 for every command, with no weakened existing tests. If a failure is caused by the refactor, fix the implementation or its focused test and rerun the full affected command.

- [ ] **Step 5: Run manual PWA verification.** With a production build and service worker enabled, record development-only marks for: first-ever launch, reopen after several hours, killed/reopened launch, poor-network reopen, unseen and previously visited title navigation, language change, logout to anonymous, logout to another user, and a new cache/schema deployment. Confirm the primary criterion: previously known content appears before network revalidation.

- [ ] **Step 6: Inspect the final diff and preserve the unrelated change.**

  Run: `git status --short; git diff -- apps/web/components/layout/app-shell.tsx; git diff --stat`

  Expected: `app-shell.tsx` contains only the pre-existing user diff, and the refactor files match the spec/plan.

- [ ] **Step 7: Commit the verification/test slice.**

  ```bash
  git add apps/web/lib/tests apps/web/lib/title apps/web/hooks/title
  git commit -m "test(web): cover local-first startup boundaries"
  ```

## Plan self-review

- Spec coverage: startup gate removal is Task 3; context-keyed QueryClient isolation is Tasks 2–3; IndexedDB persistence and budgets are Tasks 1–2; service-worker separation and strategies are Task 4; title contracts/server core/identity are Tasks 5–6; seeding/prefetch are Task 7; cached-first heavy routes are Task 8; instrumentation is Task 3; user-facing verification is Task 9.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified error-handling steps are used. Each task names files, interfaces, tests, commands, and commit boundaries.
- Type consistency: Tasks 1–3 define `QueryPersistencePolicy`, `CacheContext`, `createCacheContextKey`, `QueryCacheStorage`, `createQueryCachePersister`, and `QueryContextBoundary`; later tasks consume those names. Task 5 defines `TitlePreview`, `TitleCore`, `TitleDetailPlaceholder`, `seedTitlePreview`, and `isTitleCore`; Tasks 6–7 consume those exact contracts.
- Scope boundary: the plan does not modify `app-shell.tsx`, does not cache private API responses in the service worker, and does not persist unknown query families.
