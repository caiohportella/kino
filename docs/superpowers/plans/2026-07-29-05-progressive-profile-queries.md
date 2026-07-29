# Progressive Profile Query Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profile identity the sole page-level blocker and render relationship/content sections independently with safe cache scopes and retained data.

**Architecture:** Shared core owns keys/policies; each application owns query options, Supabase calls, composition, and rendering states.

**Tech Stack:** React Query v5, Supabase application services, React, React Native, Node tests.

## Global Constraints

- Stored activity is locale-independent; localized title summaries use separate locale/region keys.
- Never substitute data from another profile, viewer, locale, or region.
- A successful section remains visible during refresh and refresh failure.

---

### Task 1: Shared profile keys and policies

**Files:**
- Modify: `packages/core/src/cache/query-keys.ts`
- Modify: `packages/core/src/cache/policies.ts`
- Modify: `packages/core/src/cache/index.ts`
- Test: `packages/core/src/cache/query-keys.test.mjs`
- Create: `packages/core/src/cache/policies.test.mjs`

- [ ] Add failing collision tests for identity, relationship-by-viewer, each content section, availability, locale, region, page, filters, and schema version.
- [ ] Run `pnpm --filter @kino/core test -- src/cache/*.test.mjs`; expect FAIL.
- [ ] Add factories for identity, relationship, watched movies/series, statistics, watchlists, reviews, ratings, and availability plus named policies.
- [ ] Run core cache tests; expect PASS.
- [ ] Commit: `feat(profile): define scoped profile cache contracts`

### Task 2: Web progressive query options and rendering

**Coordinator-owned file:**
- Modify: `apps/web/components/profile-view.tsx`

**Supporting files:**
- Create: `apps/web/lib/profile-query-options.ts`
- Create: `apps/web/hooks/use-profile-sections.ts`
- Modify: `apps/web/hooks/use-profile-reviews.ts`
- Create: `apps/web/lib/profile-progressive-rendering.test.mjs`
- Create: `apps/web/lib/profile-query-options.test.mjs`

- [ ] Add failing tests proving the header renders while every secondary query is pending, identity alone owns page failure, relationship waits only when username resolution is needed, and previous data survives refresh failure.
- [ ] Run focused tests; expect FAIL against the monolithic `Promise.all`.
- [ ] Split identity, relationship, watched movies, watched series, statistics, watchlists, reviews, and ratings into shared-option-backed hooks; compose localized summaries separately.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `refactor(profile): render web profile sections progressively`

### Task 3: Mobile progressive queries

**Coordinator-owned files:**
- Modify: `apps/mobile/hooks/profile/useProfileData.ts`
- Modify: `apps/mobile/app/profile/[id].tsx`

**Supporting files:**
- Create: `apps/mobile/hooks/profile/profileQueryOptions.ts`
- Create: `apps/mobile/hooks/profile/useProfileSections.ts`
- Modify: `apps/mobile/components/profile/ProfileHeader.tsx`
- Modify: `apps/mobile/components/profile/WatchedMoviesSection.tsx`
- Modify: `apps/mobile/components/profile/WatchedSeriesSection.tsx`
- Create: `apps/mobile/utils/profileProgressiveRendering.test.mjs`
- Create: `apps/mobile/utils/profileQueryOptions.test.mjs`

- [ ] Add failing tests for identity-first rendering, independent sections, locale-independent activity, and retained data.
- [ ] Run focused mobile tests; expect FAIL.
- [ ] Replace monolithic state/`Promise.all` with scoped React Query options while keeping a compatibility facade until consumers migrate.
- [ ] Run focused tests and both application type-checks; expect PASS.
- [ ] Review gate and rollback: retain the old facade until all profile consumers use the split hooks; no database migration. Remove it only in Plan 7.
- [ ] Commit: `refactor(profile): split mobile profile query boundaries`

