# Plan 5: Progressive Profile Architecture — Coordinator Integration

> **Execution:** Use `superpowers:subagent-driven-development` task-by-task, with a fresh implementer and task review gate for every task. Use `superpowers:test-driven-development` for each behavioral change and `superpowers:verification-before-completion` before reporting completion.

**Goal:** Replace the web and mobile profile request aggregates with canonical-ID, independently cached profile slices while preserving existing profile presentation, Plan 4 review carousel behavior, SEO/canonical routing, and a temporary `useProfileData` compatibility surface.

**Architecture:** Shared core owns versioned cache-key factories and cache-policy descriptors. Each app owns provider calls, React Query options, invalidation execution, progressive rendering, and compatibility adapters. Username resolution produces one immutable `profileId`; identity alone controls page-level loading/error/not-found state. Relationship and content slices render, refresh, and fail independently. Stored activity is locale-independent; existing localized-title queries remain separate. Live series availability is removed from initial profile loading and deferred to Plan 6.

**Baseline:** `af12c7de57924d81075e0dcdd05e4e28128cb722`. Reuse the three verified foundation commits from `codex/progressive-profile-queries` in order: `a7a7206`, `094e72e`, `9be49f2`. The primary workspace's Portuguese `likeCount_one` correction is intentional Plan 5 input; `apps/web/next-env.d.ts` is explicitly excluded.

---

## Task 1: Integrate and reconcile the verified foundation

**Files:**
- Modify: `packages/core/src/cache/query-keys.ts`
- Modify: `packages/core/src/cache/policies.ts`
- Test: `packages/core/src/cache/query-keys.test.mjs`
- Test: `packages/core/src/cache/policies.test.mjs`
- Modify: `apps/web/lib/profile-query-options.ts`
- Modify: `apps/web/hooks/use-profile-sections.ts`
- Test: `apps/web/lib/profile-query-options.test.mjs`

1. Cherry-pick `a7a7206`, `094e72e`, and `9be49f2` in order to preserve their commit boundaries.
2. Run the focused core and web tests to confirm the imported foundation remains green.
3. Add failing tests for canonical-ID-only downstream keys, viewer-scoped relationship keys, locale-independent activity keys, and real web service signatures.
4. Reconcile `ProfileQueryService` with current database APIs without moving Supabase into core.
5. Keep the availability descriptor only as a future boundary; do not create provider fan-out or make it part of initial rendering.
6. Run focused tests, Biome on touched files, type-check, and commit the reconciliation separately.

## Task 2: Define progressive coordinator state and scoped invalidation contracts

**Files:**
- Create: `apps/web/lib/profile-progressive-state.ts`
- Create: `apps/web/lib/profile-progressive-state.test.mjs`
- Create: `apps/web/lib/profile-invalidation.ts`
- Create: `apps/web/lib/profile-invalidation.test.mjs`
- Modify: `packages/core/src/cache/query-keys.ts`
- Modify: `packages/core/src/cache/query-keys.test.mjs`

1. Write failing deterministic tests for:
   - identity as the sole page-level blocker/error owner;
   - secondary initial pending, failed, known-empty, retained-refresh, and retained-refresh-error states;
   - empty-profile eligibility only after relevant slices are known;
   - profile switches never retaining another profile's data;
   - logout/login changes relationship ownership via `viewerId`.
2. Implement pure state selectors that retain successful slice content during refetch/failure and distinguish paused from initial pending.
3. Define a discriminated, exhaustively handled invalidation descriptor/adapter mapping for identity, relationship, watched movies, watched series, statistics, watchlists, reviews, and ratings. Keep React Query mutation execution in the app.
4. Run focused tests, Biome, type-check, and commit.

## Task 3: Migrate the web profile coordinator to independent slices

**Files:**
- Modify: `apps/web/components/profile-view.tsx`
- Modify: `apps/web/hooks/use-profile-sections.ts`
- Modify: `apps/web/hooks/use-profile-reviews.ts`
- Modify: `apps/web/lib/profile-query-options.ts`
- Create: `apps/web/lib/profile-progressive-rendering.test.mjs`
- Preserve/test: `apps/web/lib/profile-reviews-section.test.mjs`
- Preserve/test: `apps/web/lib/profile-review-carousel.test.mjs`
- Preserve/test: `apps/web/lib/profile-routes.test.mjs`

1. Add failing tests proving canonical username resolution occurs once and all downstream options use `profileId`.
2. Add failing tests proving identity renders while relationship/content are pending or failed, and identity alone can trigger the whole-page error.
3. Add failing tests for independent section initial skeleton/error/retry/known-empty behavior and retained dimensions/content during refresh failure.
4. Replace the monolithic `['profile', profileId]` `Promise.all` query with identity, relationship, movies, series, statistics, watchlists, reviews, and ratings queries.
5. Preserve the server route's not-found/canonical redirect/metadata ownership, existing header/actions/dialogs, localized shelf queries, and Plan 4 `ProfileHorizontalRow` / `ProfileReviewsSection` contracts.
6. Remove `refreshSeriesAvailability` from the initial web profile graph. Stored series render immediately; no Plan 6 orchestration is introduced.
7. Keep review cache interoperability during migration by bridging existing `profileReviewKeys` rather than creating two competing mutation domains.
8. Run all focused web profile/route/carousel tests, Biome, type-check, and commit.

## Task 4: Replace broad web profile invalidation with scoped execution

**Files:**
- Modify: `apps/web/components/profile-view.tsx`
- Modify: `apps/web/app/title/[id]/page.tsx`
- Modify: `apps/web/app/diary/page.tsx`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/app/watchlists/page.tsx`
- Modify: `apps/web/app/watchlists/[id]/page.tsx`
- Modify: `apps/web/hooks/use-profile-reviews.ts`
- Modify: `apps/web/hooks/use-title-reviews.ts`
- Test: `apps/web/lib/profile-invalidation.test.mjs`

1. Extend failing invalidation tests to cover rating/diary, identity, watchlist, review, follow, banner, and subscription mutations.
2. Route each mutation through the smallest correct invalidation descriptor set; relationship descriptors always include both `profileId` and `viewerId`.
3. Retain temporary legacy invalidation only where a still-unmigrated consumer requires it, never as the sole freshness mechanism.
4. Confirm no application code ranks/reorders unrelated search results and no search contract changes enter this task.
5. Run focused tests, Biome, type-check, and commit.

## Task 5: Add mobile profile query slices behind a compatibility facade

**Files:**
- Create: `apps/mobile/hooks/profile/profileQueryOptions.ts`
- Create: `apps/mobile/hooks/profile/useProfileSections.ts`
- Modify: `apps/mobile/hooks/profile/useProfileData.ts`
- Modify: `apps/mobile/app/profile/[id].tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Create: `apps/mobile/hooks/profile/profileQueryOptions.test.mjs`
- Create: `apps/mobile/hooks/profile/profileProgressiveState.test.mjs`
- Preserve/test: `apps/mobile/utils/protectedConsumers.test.mjs`

1. Add failing tests for canonical `profileId` keys, viewer-scoped relationship keys, identity-only page status, independent content states, retained refresh failures, and profile/viewer switching.
2. Implement mobile query options using the shared keys/policies and existing React Query v5 provider. Keep database calls inside options/services.
3. Implement `useProfileSections`; compose identity, relationship/counts, watched movies, and watched series independently.
4. Reimplement `useProfileData` as a temporary compatibility facade so both existing consumers continue to compile while its `loading`/page error semantics become identity-only.
5. Migrate both screens to consume named section state where needed for correct skeleton/error/empty rendering. Do not migrate unrelated settings/auth/watchlist consumers.
6. Delete the initial-render `refreshSeriesAvailability` full-library fan-out. Preserve stored progress and existing locale/region-sensitive `useLocalizedMediaData` enrichment.
7. Run focused mobile tests, Biome, type-check, and commit.

## Task 6: Reconcile Portuguese localization and add regression coverage

**Files:**
- Modify: `locales/pt/translation.json`
- Modify if required for parity: `locales/en/translation.json`
- Create or modify: the existing locale parity/profile copy test nearest these files

1. Preserve the staged primary-workspace correction: Portuguese singular `likeCount_one` remains `{{count}} curtidas`.
2. Add only the minimum profile slice loading/error/retry labels required by the new UI, with English/Portuguese key parity.
3. Add failing locale tests before introducing any new key; validate JSON and interpolation tokens.
4. Run locale tests, Biome, and commit. Do not include `apps/web/next-env.d.ts`.

## Task 7: Architectural audits and full verification

1. Audit all profile keys and confirm downstream response-shaping inputs are represented.
2. Audit username-keyed profile queries and `useProfileData` consumers; document the intentional compatibility remainder for Plan 7.
3. Audit loading/error ownership, broad `['profile', …]` invalidations, Plan 4 carousel contracts, Portuguese strings, and absence of Plan 6 availability fan-out.
4. Verify `packages/core` contains no React, Next.js, Expo, Supabase, Upstash, provider SDK, environment, or cache-mutation imports.
5. Run fresh:
   - `pnpm biome check .`
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build:web`
   - focused core profile cache tests
   - focused web profile query/state/rendering/route/carousel tests
   - focused mobile profile query/state/consumer tests
6. Confirm the worktree is clean, Plan 5 commits are based on `af12c7d`, the primary workspace is unchanged, `apps/web/next-env.d.ts` is absent from the Plan 5 diff, and nothing was pushed or opened as a pull request.

