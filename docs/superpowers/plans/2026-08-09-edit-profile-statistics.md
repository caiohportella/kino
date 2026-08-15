# Edit Profile Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Kino Edit Profile page layout and add a reusable statistics experience with a compact sidebar summary and a dedicated stats route.

**Architecture:** Keep the current settings page as the authenticated editor entry point, but move stats calculation into a reusable profile-statistics data path that can later feed public profile views. Persist TV episode runtime at title-ingest time so total watch time can be derived from stored metadata instead of duplicated heuristics. The UI layer should stay shallow: one reusable stats summary component, one query hook, one dedicated stats page, and localized time formatting utilities.

**Tech Stack:** TypeScript, Next.js App Router, React Query v5, Supabase-backed data access, shadcn/Base UI cards and buttons, Kino i18n JSON resources, Lucide icons, Node test runner.

## Global Constraints

- Preserve Kino’s existing visual identity, dark theme, green accent color, minimalist/premium spacing, and responsive behavior.
- Keep the existing two-column desktop layout on Edit Profile, but improve hierarchy without inflating page height.
- Keep the global Save action in the page header.
- Do not duplicate stats calculations inside the settings page.
- Use localized strings for every user-facing label, CTA, and duration unit.
- Prefer existing diary, episode-rating, and title-rating semantics over inventing new watch-count logic.
- Total watch time must skip titles without runtime metadata instead of fabricating values.
- The dedicated statistics page should be route-compatible with Kino’s existing username profile routing.
- Keep destructive account actions visually restrained and preserve all existing confirmation behavior.

---

### Task 1: Add reusable lifetime profile stats to the core data layer

**Files:**
- Modify: `packages/core/src/tmdb.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/database.ts`
- Modify: `packages/core/src/cache/query-keys.ts`
- Modify: `packages/core/src/cache/index.ts`
- Modify: `packages/core/src/cache/query-keys.test.mjs`
- Create: `packages/core/src/profile-stats.test.mjs`

**Interfaces:**
- Consumes: existing `title_ratings`, `episode_ratings`, `watch_diary`, `titles`, and TMDb title ingestion paths.
- Produces: a reusable `ProfileLifetimeStats` shape that includes movie watches, episode watches, total runtime minutes, and ratings made.

- [ ] **Step 1: Write the failing tests**

Add tests that prove:

- TV title ingestion records a per-episode runtime from TMDb when available.
- The stats query key has a distinct lifetime-stats root instead of reusing the existing public statistics key.
- The profile statistics shape can represent zero-state values cleanly.
- The total-runtime helper ignores rows without runtime metadata instead of throwing.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
node --test packages/core/src/cache/query-keys.test.mjs packages/core/src/profile-stats.test.mjs
```

Expected: FAIL because the new runtime/statistics helpers and query key do not exist yet.

- [ ] **Step 3: Implement the core data path**

Add the new lifetime stats model and query key, extend TMDb TV ingestion so a persisted episode runtime is available for later aggregation, and implement core aggregation that counts:

- movie diary/watch records representing completed movie watches
- watched TV episodes from the authoritative episode-rating source
- total runtime from persisted title runtime metadata only
- ratings actually submitted by the user

Make the aggregation resilient to missing metadata and keep the logic reusable for future public-profile consumption.

- [ ] **Step 4: Run the focused tests again**

Run the same `node --test ...` command and confirm it passes.

- [ ] **Step 5: Verify the broader core surface still compiles**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS.

### Task 2: Add a reusable web stats query, formatter, and invalidation path

**Files:**
- Create: `apps/web/lib/profile-stats.ts`
- Create: `apps/web/lib/profile-stats.test.mjs`
- Create: `apps/web/lib/profile-stats-query.ts`
- Create: `apps/web/hooks/use-profile-stats.ts`
- Modify: `apps/web/lib/profile-query-service.ts`
- Modify: `apps/web/lib/profile-invalidation.ts`
- Modify: `apps/web/lib/profile-invalidation.test.mjs`
- Modify: `apps/web/lib/routes.ts`
- Modify: `apps/web/lib/routes.test.mjs`

**Interfaces:**
- Consumes: the new core lifetime-stats service method and the existing `KinoDatabaseService` profile adapters.
- Produces: a web-facing query hook and formatter that both the settings page and dedicated stats page can reuse.

- [ ] **Step 1: Write the failing tests**

Add tests that prove:

- the new lifetime stats query wraps the core service without re-implementing aggregation in React
- the watch-time formatter returns compact localized strings like `8h 24m` and `3d 7h`
- the formatter exposes accessible full-duration text without bloating the visible UI
- lifetime-statistics invalidation is triggered alongside the existing rating/diary mutations
- the route helper generates the stats URL for a username without hardcoding string concatenation in the page

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
node --test apps/web/lib/profile-stats.test.mjs apps/web/lib/profile-invalidation.test.mjs apps/web/lib/routes.test.mjs
```

Expected: FAIL because the new query, formatter, and route helper do not exist yet.

- [ ] **Step 3: Implement the web query and formatter**

Add a small, reusable lifetime-stats query module, a compact localized watch-time formatter, and the username stats route helper. Extend the legacy profile-query-service adapter so the web layer can fetch the new core stats method from profile id-based callers. Update invalidation descriptors so diary and rating mutations refresh the new stats query as well as the existing profile slices.

- [ ] **Step 4: Run the focused tests again**

Run the same `node --test ...` command and confirm it passes.

- [ ] **Step 5: Verify app-level type safety**

Run:

```bash
pnpm --filter @kino/web typecheck
```

Expected: PASS.

### Task 3: Refine the Settings page layout and add the sidebar statistics card

**Files:**
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/app/settings/loading.tsx`
- Modify: `apps/web/components/skeletons/page-skeletons.tsx`
- Modify: `apps/web/components/ui/card.tsx` if needed only for composition, not for redesign
- Create: `apps/web/components/profile/profile-stat-summary-card.tsx`
- Create: `apps/web/components/profile/profile-stat-summary-card.test.mjs`

**Interfaces:**
- Consumes: the reusable lifetime stats query hook, formatter, and route helper.
- Produces: a compact sidebar statistics card with a 2 x 2 metric grid and a CTA to the dedicated stats page.

- [ ] **Step 1: Write the failing UI-shape tests**

Add tests that prove:

- the profile editor keeps the avatar and form fields visually grouped
- the banner preview uses the new more compact cinematic ratio
- the sidebar order is Statistics, Language, Import history, Account
- the account card title changes to the localized Account label
- the statistics card renders a 2 x 2 grid, not a dense dashboard
- the loading state mirrors the new settings page structure instead of using a generic spinner

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
node --test apps/web/lib/profile-stats.test.mjs apps/web/lib/routes.test.mjs apps/web/lib/profile-invalidation.test.mjs
```

Expected: FAIL until the reusable stats summary component and settings-page layout changes are implemented.

- [ ] **Step 3: Implement the settings page and skeleton updates**

Rework the main settings card so the avatar, display name, username, and biography feel like one profile-editing unit, reduce banner visual dominance, and keep the Save button in the header. Add a compact sidebar stats summary card above the Language card, preserve the current language/import/account cards, and rename the account-management card title from Profile to Account. Update the settings skeleton to match the new two-column structure and the statistics card’s 2 x 2 shape.

- [ ] **Step 4: Verify the settings page compiles cleanly**

Run:

```bash
pnpm --filter @kino/web typecheck
pnpm --filter @kino/web lint
```

Expected: PASS.

### Task 4: Build the dedicated profile statistics page and loading state

**Files:**
- Create: `apps/web/app/[username]/stats/page.tsx`
- Create: `apps/web/app/[username]/stats/loading.tsx`
- Create: `apps/web/app/[username]/stats/layout.tsx` if metadata or route composition needs it
- Modify: `apps/web/app/[username]/page.tsx` only if a small link integration or shared component extraction is needed
- Modify: `apps/web/lib/server-metadata.ts` if the new route needs canonical metadata helpers
- Modify: `apps/web/lib/profile-routes.ts` if the project uses profile route helpers there instead of `routes.ts`

**Interfaces:**
- Consumes: the lifetime-stats query hook, stats formatter, route helper, and shared summary component.
- Produces: a minimal stats page with the four primary summary metrics and a structure that can later host richer analytics sections.

- [ ] **Step 1: Write the failing route and page tests**

Add tests that prove:

- `/[username]/stats` resolves through the same username profile conventions as the existing profile route
- the page shows the four summary metrics and a sensible zero state
- the loading state matches the eventual page composition instead of blocking the whole profile experience

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
node --test apps/web/lib/routes.test.mjs apps/web/lib/profile-stats.test.mjs
```

Expected: FAIL until the route and page exist.

- [ ] **Step 3: Implement the stats page**

Build the page with the same Kino card system and minimal structure:

- summary metrics at the top
- room for future analytics sections below
- no fake charts or placeholder widgets
- proper empty and error states

Make the page consume the reusable stats helper rather than recalculate totals locally.

- [ ] **Step 4: Add the settings-page CTA**

Link the sidebar card CTA to the new stats route using the shared route helper and a localized `View statistics` label.

- [ ] **Step 5: Verify the route end-to-end**

Run:

```bash
pnpm --filter @kino/web typecheck
pnpm --filter @kino/web test
```

Expected: PASS.

### Task 5: Localize every new string and finish verification

**Files:**
- Modify: `locales/en/translation.json`
- Modify: `locales/fr/translation.json`
- Modify: `locales/it/translation.json`
- Modify: `locales/no/translation.json`
- Modify: `locales/pt/translation.json`
- Modify: `apps/web/lib/profile-stats.test.mjs`
- Modify: `apps/web/components/profile/profile-stat-summary-card.test.mjs`

**Interfaces:**
- Consumes: the new stats card, formatter, and stats route copy.
- Produces: complete locale coverage for the sidebar card, stats page, and time-unit formatting.

- [ ] **Step 1: Add failing i18n coverage tests**

Add tests that prove every new key resolves in all supported locales and that fallback behavior remains intact.

- [ ] **Step 2: Run the i18n tests and confirm they fail**

Run:

```bash
node --test apps/web/lib/profile-stats.test.mjs
```

Expected: FAIL until all locale files include the new keys.

- [ ] **Step 3: Add translations**

Add localized equivalents for:

- Statistics
- Movies watched
- Episodes watched
- Time watched
- Ratings made
- View statistics
- Account
- days
- hours
- minutes

Reuse existing wording where Kino already has a suitable translation and keep the copy restrained.

- [ ] **Step 4: Run final verification**

Run:

```bash
pnpm check
```

If that is too broad for the current branch, fall back to:

```bash
pnpm --filter @kino/web test
pnpm --filter @kino/web lint
pnpm --filter @kino/web typecheck
pnpm exec tsc --noEmit
```

Also verify visually at mobile, tablet, and desktop widths:

- the settings page still collapses cleanly to one column
- the sidebar stats card stays compact
- the banner remains cropped and responsive
- the dedicated stats page renders without overflow
- account actions still behave exactly as before

---

### Self-Review Checklist

- [ ] Every requested user-facing string has a task that localizes it.
- [ ] The plan uses the existing profile, diary, and rating semantics instead of inventing new counts.
- [ ] Runtime handling is explicit about missing metadata being skipped.
- [ ] The settings page, stats card, and stats route are separated into independently reviewable tasks.
- [ ] Verification commands are concrete and match the repository scripts.
