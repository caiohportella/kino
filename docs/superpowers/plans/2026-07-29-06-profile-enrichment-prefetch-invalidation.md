# Availability Enrichment, Prefetching, and Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move series availability outside initial rendering, bound request work, prefetch safe profile data, and replace universal profile invalidation with exhaustive minimum-scope descriptors.

**Architecture:** Core supplies bounded execution and invalidation intent; application adapters own React Query, TMDB requests, link events, and metrics.

**Tech Stack:** TypeScript, React Query v5, TMDB application services, Node tests.

## Global Constraints

- Limit the candidate window as well as concurrency.
- Do not fetch full seasons merely because cards mount.
- Persistence remains deferred.
- Plan 5 must be integrated and passing before this plan begins.
- Coordinator-owned profile composition files are integrated only after focused domain tests pass.

---

### Task 1: Core bounded executor and invalidation union

**Files:**
- Create: `packages/core/src/concurrency/bounded-map.ts`
- Create: `packages/core/src/concurrency/bounded-map.test.mjs`
- Create: `packages/core/src/cache/profile-invalidations.ts`
- Create: `packages/core/src/cache/profile-invalidations.test.mjs`
- Modify: `packages/core/src/cache/index.ts`

- [ ] Add failing tests for maximum active work, bounded candidate slices, isolated failures, stable output, and invalidation descriptors for review/follow/diary/rating/progress/watchlist/identity mutations.
- [ ] Run core focused tests; expect FAIL.
- [ ] Implement pure utilities and a discriminated invalidation union.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `feat(profile): define bounded enrichment and invalidation intent`

### Task 2: Application availability orchestrators

**Files:**
- Create: `apps/web/lib/profile-availability.ts`
- Create: `apps/web/hooks/use-series-availability.ts`
- Create: `apps/mobile/hooks/profile/useSeriesAvailability.ts`
- Modify: `apps/web/components/profile-view.tsx`
- Modify: `apps/mobile/components/profile/WatchedSeriesSection.tsx`
- Test: `apps/web/lib/profile-availability.test.mjs`
- Create: `apps/mobile/utils/profileAvailability.test.mjs`

- [ ] Add failing request-count tests for stored-progress first render, bounded visible/recent window, locale/region season keys, deduplication, maximum concurrency, per-season failures, and retained enrichment.
- [ ] Run focused tests; expect FAIL against current full-library `Promise.all`.
- [ ] Implement bounded background enrichment with injected fetchers and no focus-driven full refresh.
- [ ] Run focused tests; expect PASS with asserted request counts.
- [ ] Commit: `perf(profile): move bounded availability off critical path`

### Task 3: Prefetch, exhaustive invalidation, and metrics

**Files:**
- Create: `apps/web/lib/profile-prefetch.ts`
- Create: `apps/mobile/utils/profilePrefetch.ts`
- Create: `apps/web/lib/profile-invalidation.ts`
- Create: `apps/mobile/utils/profileInvalidation.ts`
- Create: `apps/web/lib/profile-metrics.ts`
- Create: `apps/mobile/utils/profileMetrics.ts`
- Modify: profile links and mutation owners found by `rg "invalidateQueries.*profile" apps/web apps/mobile`.
- Test: `apps/web/lib/profile-prefetch.test.mjs`
- Test: `apps/web/lib/profile-invalidation.test.mjs`
- Create: `apps/mobile/utils/profilePrefetch.test.mjs`
- Create: `apps/mobile/utils/profileInvalidation.test.mjs`

- [ ] Add failing tests for hover/focus/touch/press prefetch, navigation deduplication, safe bounded resources, exhaustive descriptor switches, smallest-scope invalidation, logout isolation, and redacted development metrics.
- [ ] Run focused tests; expect FAIL.
- [ ] Wire shared query options into profile links and replace broad profile invalidations with exhaustive adapters.
- [ ] Run focused tests plus type-check; expect PASS and compile-time exhaustiveness.
- [ ] Review gate and rollback: compare mutation cache effects before deleting broad invalidations. Reverting these commits restores prior behavior without data changes.
- [ ] Commit: `perf(profile): prefetch and invalidate precise profile scopes`
