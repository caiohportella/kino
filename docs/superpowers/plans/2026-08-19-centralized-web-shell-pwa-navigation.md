# Centralized Web Shell and PWA Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Kino's shared 1320px centered browser shell and make standalone PWA navigation use only a bottom bar with an authenticated profile destination.

**Architecture:** Add one `AppContainer` primitive that owns the single 1320px boundary and shell padding. Keep shell geometry in `AppShell`, use one standalone-mode hook plus shell state for top/bottom navigation decisions, and extract authenticated profile-section matching into a route helper consumed by the bottom nav.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Zustand auth store, TanStack Query, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-19-centralized-web-shell-pwa-navigation-design.md`

## Global Constraints

- The `1320px` design boundary must be defined once in a shared container primitive or class.
- The shared container owns horizontal padding; shell consumers must not add duplicate horizontal shell padding.
- Standalone PWA is authoritative for PWA bottom-nav configuration; ordinary mobile browsers retain browser navigation behavior.
- Standalone detection supports `display-mode: standalone` and iOS `navigator.standalone` without server-side browser API access or a visible navbar flash.
- Profile matching must distinguish the authenticated user's profile section from another user's profile section.
- Reuse existing auth, profile, avatar, route, translation, and safe-area utilities.

---

### Task 1: Add and test the shared shell container

**Files:**
- Create: `apps/web/components/layout/app-container.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/app-footer.tsx`
- Test: `apps/web/lib/tests/layout/app-container.test.mjs`

**Interfaces:**
- Produces `AppContainer({ children, className? }: { children: ReactNode; className?: string })`.
- Provides the only shell-level `1320px` max-width rule and responsive horizontal padding.

- [ ] **Step 1: Write the failing structural test**

Assert that the shared container source defines the 1320px boundary once and that shell/page consumers reference `AppContainer` rather than independent `max-w-[1320px]` or shell-level `px-*` rules. Use source-level assertions consistent with existing `apps/web/lib/tests` architecture tests.

- [ ] **Step 2: Run the focused test and verify it fails for the missing primitive**

Run: `pnpm --filter @kino/web test -- apps/web/lib/tests/layout/app-container.test.mjs`

Expected: FAIL because `AppContainer` and the centralized boundary do not exist yet.

- [ ] **Step 3: Implement the primitive and shell consumers**

Create `AppContainer` with a single class such as `mx-auto w-full max-w-[1320px] px-[clamp(16px,2vw,40px)]`, and move shell horizontal padding out of `.page-main` and the header's inline JSX. Wrap the header content, `main` content, and aligned footer content with the primitive. Keep `.page-main` responsible for vertical padding, flex sizing, and bottom-nav compensation only.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `pnpm --filter @kino/web test -- apps/web/lib/tests/layout/app-container.test.mjs`

Expected: PASS.

Run: `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`

Expected: PASS with no new TypeScript errors.

- [ ] **Step 5: Inspect the diff for duplicate shell geometry**

Run: `rg -n "1320|max-w-\[1320px\]|page-main|AppContainer|app-header-inner" apps/web/app apps/web/components/layout apps/web/lib/tests/layout`

Confirm the numeric boundary appears only in the shared primitive/class and that `.page-main` no longer owns shell-level horizontal padding.

### Task 2: Centralize standalone detection and shell navigation geometry

**Files:**
- Create: `apps/web/hooks/use-standalone-mode.ts`
- Create: `apps/web/hooks/use-standalone-mode.test.mjs`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces `useStandaloneMode(): boolean`.
- Detection helper, if extracted for testing, accepts a `MediaQueryList` result and optional iOS standalone boolean and returns the authoritative standalone state.

- [ ] **Step 1: Write failing detection tests**

Cover `display-mode: standalone`, iOS `navigator.standalone`, false browser mode, and safe behavior when browser globals are unavailable during server rendering.

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run: `node --test --experimental-strip-types apps/web/hooks/use-standalone-mode.test.mjs`

Expected: FAIL because the hook/helper does not exist.

- [ ] **Step 3: Implement the hook with hydration-safe shell behavior**

Read browser APIs only inside the client effect/initializer guarded by `typeof window !== 'undefined'` and `typeof navigator !== 'undefined'`. Subscribe to `matchMedia('(display-mode: standalone)')` changes. Initialize the shell with a stable state that does not render a browser top nav and then remove it after hydration; use shell state/classes/CSS so standalone mode has no reserved header height or sticky offset.

- [ ] **Step 4: Update `AppShell` navigation decisions**

Render the top header only in browser mode. Render the bottom PWA nav only when `standalone && user`. Apply the class controlling bottom padding only when that nav actually exists. Preserve the existing auth callback, landing, and auth-resolution branches.

- [ ] **Step 5: Update geometry CSS and run tests**

Remove unconditional standalone-inapplicable header offsets from title/sidebar calculations, keep browser sticky offsets tied to the visible header, and retain safe-area bottom spacing for standalone bottom navigation. Run the focused hook tests and web typecheck.

Expected: PASS with no hydration-unsafe browser API access.

### Task 3: Extract profile-section route matching

**Files:**
- Modify: `apps/web/lib/routes.ts`
- Modify: `apps/web/lib/routes.test.mjs`
- Create or modify: `apps/web/lib/profile/profile-routes.ts`
- Create or modify: `apps/web/lib/profile/profile-routes.test.mjs`

**Interfaces:**
- Produces `isProfileSectionPath(pathname: string, username: string): boolean`.
- Reuses the repository's canonical username normalization/route helper instead of duplicating route rules in the nav.

- [ ] **Step 1: Write failing route tests**

Assert true for `/caio`, `/caio/stats`, `/caio/stats/recap/2026/08`, and other authenticated profile-owned descendants. Assert false for `/other`, `/other/stats`, malformed paths, and paths with a different username casing when the existing canonicalization says they are distinct.

- [ ] **Step 2: Run the route tests and verify they fail**

Run: `node --test --experimental-strip-types apps/web/lib/profile/profile-routes.test.mjs`

Expected: FAIL because the helper is absent.

- [ ] **Step 3: Implement the helper**

Normalize the pathname into non-empty segments, compare the first segment to the canonical authenticated username using existing route normalization, and treat only the authenticated username's profile descendants as profile-section paths. Avoid matching arbitrary root pages or another user's profile.

- [ ] **Step 4: Run route tests and existing route tests**

Run: `node --test --experimental-strip-types apps/web/lib/profile/profile-routes.test.mjs apps/web/lib/routes.test.mjs`

Expected: PASS.

### Task 4: Add the standalone PWA profile destination

**Files:**
- Modify: `apps/web/components/layout/mobile-bottom-nav.tsx`
- Modify: `apps/web/components/layout/app-shell.tsx`
- Modify: `apps/web/components/layout/account-menu.tsx` if profile query data needs a shared hook/export
- Test: `apps/web/lib/tests/layout/mobile-bottom-nav.test.mjs`

**Interfaces:**
- `MobileBottomNav` receives the authenticated profile identity needed to build the canonical profile href and render avatar/fallback.
- Consumes `isProfileSectionPath(pathname, username)`.

- [ ] **Step 1: Write failing nav behavior tests**

Cover profile item presence only for authenticated standalone configuration, avatar image when `avatar_url` exists, fallback icon/initials when absent, accessible label, canonical profile href, active state for profile/stats/recap paths, and inactive state for another user's profile.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter @kino/web test -- apps/web/lib/tests/layout/mobile-bottom-nav.test.mjs`

Expected: FAIL because the profile item and extracted active-state helper are missing.

- [ ] **Step 3: Implement profile data and navigation**

Reuse the existing navbar profile query/avatar components, preferably by extracting a small shared profile-data hook from `account-menu.tsx` if needed. Add a profile link to the standalone nav, use the canonical username route, render the avatar image or existing profile/user fallback, and set `aria-label`/`aria-current` correctly.

- [ ] **Step 4: Make the layout evenly distribute six destinations**

Use a grid or flex layout that derives its columns from the actual item count, remains within narrow phone widths, preserves selected-state treatment, and includes safe-area spacing without horizontal overflow. Keep settings/logout out of the bottom bar.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm --filter @kino/web test -- apps/web/lib/tests/layout/mobile-bottom-nav.test.mjs`

Expected: PASS.

Run: `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`

Expected: PASS.

### Task 5: Full verification and responsive review

**Files:**
- Modify only files required by Tasks 1–4.
- Test: existing web test suite and quality scripts.

- [ ] **Step 1: Run web tests, lint, typecheck, and build**

Run:

```bash
pnpm quality:web
pnpm --filter @kino/web lint
pnpm exec tsc --noEmit -p apps/web/tsconfig.json
pnpm --filter @kino/web test
pnpm --filter @kino/web build
```

Expected: each command exits 0 with no new warnings or failures.

- [ ] **Step 2: Inspect the final source invariants**

Run:

```bash
rg -n "1320|display-mode|navigator\.standalone|isProfileSectionPath|has-mobile-bottom-nav|app-header-height" apps/web
git diff --check
```

Confirm the 1320px boundary is centralized, standalone checks are not scattered through pages, profile matching is helper-based, and no duplicate shell padding or hidden header offsets remain.

- [ ] **Step 3: Perform manual responsive verification**

Check wide desktop, tablet, narrow mobile browser, and standalone PWA dimensions for `/discover`, `/activity`, `/watchlists`, `/[username]`, `/[username]/stats`, a recap route, and a title page. Verify browser top-nav presence, standalone zero top-nav space, profile avatar navigation/active state, safe-area bottom spacing, no content overlap, no horizontal overflow, and no hydration/layout jump.

- [ ] **Step 4: Review the diff boundary**

Run: `git diff --stat && git diff -- apps/web/components/layout apps/web/hooks apps/web/lib/routes.ts apps/web/lib/profile apps/web/app/globals.css docs/superpowers`

Confirm only the shell/PWA/profile-route implementation and its tests/docs are included; do not stage or alter the repository's pre-existing unrelated work.
