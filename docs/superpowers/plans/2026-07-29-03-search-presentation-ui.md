# Normalized Search Presentation and UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove relevance-as-rating bugs and migrate web/mobile search to shared normalized title/person presentation models with full-width responsive results and skeletons.

**Architecture:** Platform adapters translate shared search results into existing card props; raw gateway metadata never reaches title cards.

**Tech Stack:** React, React Native, React Query, Tailwind CSS, i18n, Node tests.

## Global Constraints

- Preserve existing `TitleCard` components and home-page rating behavior.
- Missing ratings stay absent; normalize rating once.
- Search controls and results use separate layout containers.
- Plans 1 and 2 must be integrated and passing before this plan begins.
- Root search consumers are coordinator-owned.

---

### Task 1: Shared presentation helpers and localization

**Files:**
- Create: `packages/core/src/search/presentation.ts`
- Modify: `packages/core/src/search/index.ts`
- Modify: `locales/en/translation.json`
- Modify: `locales/pt/translation.json`
- Test: `packages/core/src/search/presentation.test.mjs`

**Interfaces:**
- Produces: `toSearchTitleCardModel(result, { localizedTitle, localizedPoster, displayRating })` and `getLocalizedPersonDepartment(department, labels)`.
- Consumes: Plan 1 result contracts and application-supplied localized title/poster data.

- [ ] Write failing tests for nullable ratings, one-time normalization, canonical movie/series routes, and Acting/Directing/Writing/Production/Sound/Creator/fallback labels.
- [ ] Run `pnpm --filter @kino/core test -- src/search/presentation.test.mjs`; expect FAIL.
- [ ] Implement pure adapters without importing i18n runtimes. The application calls the existing authoritative home-card rating resolver exactly once and supplies nullable `displayRating`; the adapter only transports it.
- [ ] Run the focused test; expect PASS.
- [ ] Commit: `feat(search): normalize search card presentation`

### Task 2: Web search migration and layout

**Coordinator-owned file:**
- Modify: `apps/web/app/search/page.tsx`

**Supporting files:**
- Modify: `apps/web/components/skeletons/page-skeletons.tsx`
- Create: `apps/web/lib/search/presentation.ts`
- Test: `apps/web/lib/search/consumer.test.mjs`
- Create: `apps/web/lib/search/presentation.test.mjs`
- Create: `apps/web/lib/search/layout.test.mjs`

**Interfaces:**
- Consumes: shared presentation model and existing `MediaCard`/profile-person card props.
- Produces: full-width groups with profession labels and correct rating values.

- [ ] Add failing tests proving `result.score` is never assigned to `vote_average`, Clear is confined to the form row, and skeleton/result sections share full width. Use source scans only for the prohibited mapping; use component behavior and computed DOM geometry plus screenshots/measurements when infrastructure exists.
- [ ] Run `pnpm --filter @kino/web test -- lib/search/consumer.test.mjs lib/search/presentation.test.mjs lib/search/layout.test.mjs`; expect FAIL.
- [ ] Replace `toSearchGroups` raw adaptation with the platform presentation adapter; separate form and results containers; compute sufficient skeleton capacity from shared grid geometry.
- [ ] Run focused web tests and accessibility assertions; expect PASS.
- [ ] Commit: `fix(search): render normalized full-width web results`

### Task 3: Mobile search migration

**Coordinator-owned file:**
- Modify: `apps/mobile/app/(tabs)/search.tsx`

**Supporting files:**
- Create: `apps/mobile/utils/searchPresentation.ts`
- Modify: `apps/mobile/components/common/TitleCard.tsx` only if its existing nullable rating contract requires a compatible extension.
- Test: `apps/mobile/utils/searchGatewayConsumers.test.mjs`
- Create: `apps/mobile/utils/searchPresentation.test.mjs`

- [ ] Add failing tests proving `gatewayTitle` no longer maps `score` to `vote_average`, V2 is requested while V1 remains parseable for rollback, and person departments are localized.
- [ ] Run `pnpm --filter @kino/mobile test -- utils/searchGatewayConsumers.test.mjs utils/searchPresentation.test.mjs`; expect FAIL.
- [ ] Use the shared presentation contract and preserve existing navigation/accessibility behavior.
- [ ] Run focused tests plus web/mobile type-check; expect PASS.
- [ ] Review gate and rollback: compare home cards before/after, exact-title/user/autocomplete tests, and schema compatibility. Old adapters remain revertible until both clients pass.
- [ ] Commit: `fix(search): migrate mobile search presentation`
