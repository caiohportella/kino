# Kino Locale-Ready Cache and Localized Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve locale before title queries, centralize deterministic cache keys and image selection, and provide bounded prefetch adapters.

**Architecture:** Pure normalization, key factories, and image selection live in core. Platform hooks own persistence and React Query. Consumer migration is deferred.

**Tech Stack:** TypeScript, React Query v5, Zustand persist, AsyncStorage, TMDB metadata, Node test runner.

## Global Constraints

- Category 1 must already pass.
- Work in an isolated locale-cache worktree.
- Do not edit auth internals or search ranking.
- Coordinator owns shared exports, manifests, providers, layouts, and configuration.
- Defaults are named 24-hour stale and seven-day GC policies; justified overrides are named.

---

### Task 1: Locale and Cache Scope Contracts

**Files:**
- Create: `packages/core/src/localization/locale.ts`
- Create: `packages/core/src/localization/types.ts`
- Create: `packages/core/src/localization/locale.test.mjs`
- Create: `packages/core/src/cache/policies.ts`
- Create: `packages/core/src/cache/query-keys.ts`
- Create: `packages/core/src/cache/query-keys.test.mjs`
- Create: `packages/core/src/cache/index.ts`
- Create: `packages/core/src/localization/index.ts`
- Modify (coordinator): `packages/core/src/index.ts`

**Interfaces:**
- Produces: `normalizeLocale(input): NormalizedLocale`
- Produces: `CacheScope = { kind: 'public' } | { kind: 'authenticated'; userId: string }`
- Produces: `titleQueryKeys`, `searchQueryKeys`, `profileQueryKeys`, `watchlistQueryKeys`
- Produces: `LOCALIZED_TITLE_STALE_TIME`, `LOCALIZED_TITLE_GC_TIME`

- [ ] **Step 1: Write failing literal key tests**

```js
assert.deepEqual(titleQueryKeys.details({
  id: 238,
  mediaType: 'movie',
  locale: 'pt-BR',
  region: 'BR',
  scope: { kind: 'public' },
}), ['v1', 'title', 'details', 'movie', 238, 'pt-BR', 'BR', 'public'])
```

- [ ] **Step 2: Verify RED**

Run core tests; expect missing modules.

- [ ] **Step 3: Implement normalization and readonly tuple factories**

Reject empty authenticated user IDs. Normalize locale casing and uppercase region.

- [ ] **Step 4: Verify GREEN**

Cover locale, region, scope, page, filters, and schema separation; run core tests.

- [ ] **Step 5: Commit**

```text
refactor[cache]: centralize locale-aware query keys

Add deterministic versioned factories and named localized-title cache policies.
```

### Task 2: Localized Image Resolver

**Files:**
- Create: `packages/core/src/localization/images.ts`
- Create: `packages/core/src/localization/images.test.mjs`

**Interfaces:**
- Produces: `selectLocalizedImage(input: SelectLocalizedImageInput): LocalizedImageSelection`
- Supports `poster | backdrop | logo | profile`.
- Returns selected path, language tier, and fallback reason.

- [ ] **Step 1: Write failing table tests**

Include exact locale, base language, configured fallback, original language, neutral, TMDB default, missing path, quality tie, and placeholder cases.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @kino/core test`
Expected: missing resolver failure.

- [ ] **Step 3: Implement stable tier and quality ordering**

Never mutate provider arrays. Use a stable ID/path tie-break after quality and votes.

- [ ] **Step 4: Verify GREEN and determinism**

Run the same shuffled fixtures and assert identical selection.

- [ ] **Step 5: Commit**

```text
refactor[media]: centralize localized image selection

Choose locale-correct TMDB assets with deterministic fallback and quality ordering.
```

### Task 3: Platform Locale Readiness

**Files:**
- Create: `apps/web/lib/locale-readiness.ts`
- Create: `apps/web/lib/locale-readiness.test.mjs`
- Modify: `apps/web/stores/settings-store.ts`
- Create: `apps/mobile/utils/localeReadiness.ts`
- Create: `apps/mobile/utils/localeReadiness.test.mjs`
- Modify: `apps/mobile/i18n.ts`
- Modify: `apps/mobile/hooks/useLanguage.ts`
- Modify (coordinator): `apps/web/app/providers.tsx`
- Modify (coordinator): `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Produces platform status: `'resolving' | 'ready' | 'error'`.
- Locale-sensitive hooks consume only ready normalized locale.

- [ ] **Step 1: Write failing hydration tests**

Test delayed persisted locale, invalid stored locale fallback, storage error, and one-time hydration.

- [ ] **Step 2: Verify RED**

Run web and mobile tests; expect readiness API absent.

- [ ] **Step 3: Implement injected persistence adapters**

Do not render locale-sensitive children until ready. Storage errors resolve to explicit fallback locale plus error metadata.

- [ ] **Step 4: Verify**

Run platform tests and typechecks; expect pass.

- [ ] **Step 5: Commit**

```text
refactor[locale]: resolve language before media queries

Expose explicit persisted-locale readiness for web and Expo without changing translation resources.
```

### Task 4: React Query and Prefetch Adapters

**Files:**
- Create: `apps/web/lib/title-queries.ts`
- Create: `apps/web/lib/title-prefetch.ts`
- Create: `apps/web/lib/title-prefetch.test.mjs`
- Create: `apps/mobile/hooks/data/titleQueries.ts`
- Create: `apps/mobile/utils/titlePrefetch.ts`
- Create: `apps/mobile/utils/titlePrefetch.test.mjs`
- Modify: `apps/web/lib/use-localized-titles.ts`
- Modify: `apps/mobile/hooks/data/useLocalizedMediaData.ts`

**Interfaces:**
- Produces compatible localized summary query options on both platforms.
- Produces `prefetchTitleSummary(queryClient, input): Promise<void>`.
- Full details are prefetched only on navigation intent.

- [ ] **Step 1: Write failing cache compatibility and dedup tests**

Assert same-locale card summary seeds the detail placeholder and concurrent identical prefetch calls invoke the fetcher once.

- [ ] **Step 2: Verify RED**

Run platform tests; expect missing helpers.

- [ ] **Step 3: Implement query options and bounded prefetch**

Use `ensureQueryData`/`prefetchQuery`, factory keys, and named policies. Never use another locale as placeholder data.

- [ ] **Step 4: Verify**

Run focused tests, lint, and typecheck.

- [ ] **Step 5: Review and commit**

Specification review: locale/region/scope isolation and no full-detail fan-out.
Quality review: factories are the only key construction source.

```text
feat[cache]: add localized title prefetch adapters

Seed compatible summaries and deduplicate navigation-intent requests across web and mobile.
```

## Category Verification

Run core locale/key/image tests, platform readiness/prefetch tests, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
Expected: all pass. Screen migration remains deferred.

