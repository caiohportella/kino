# Kino Web Hooks and Lib Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the feature-oriented organization of the Kino web hooks and lib modules while preserving behavior.

**Architecture:** Finish the existing domain folders, add only the title, SEO, TMDb, and reviews boundaries justified by current consumers, and keep generic browser/server primitives at the shared level. Update imports directly and avoid compatibility barrels.

**Tech Stack:** Next.js 15, React 19, TypeScript, TanStack Query, Node test runner, pnpm, Biome.

**Spec:** `docs/superpowers/specs/2026-08-18-web-hooks-lib-reorganization-design.md`

## Global Constraints

- Preserve application behavior, query keys, API contracts, localization behavior, TMDb behavior, and client/server semantics.
- Do not modify unrelated pre-existing worktree changes.
- Do not leave stale legacy imports, duplicate moved files, compatibility files, or empty legacy directories.
- Prefer direct imports; do not add broad barrel files.

---

### Task 1: Complete hook ownership moves

**Files:**
- Move: `apps/web/hooks/use-followed-ratings.ts` → `apps/web/hooks/title/use-followed-ratings.ts`
- Move: `apps/web/hooks/use-media-poster.ts` → `apps/web/hooks/title/use-media-poster.ts`
- Move: `apps/web/hooks/use-review-like-mutation.ts` → `apps/web/hooks/reviews/use-review-like-mutation.ts`
- Move test: `apps/web/lib/horizontal-overflow.test.mjs` → `apps/web/hooks/use-horizontal-overflow.test.mjs`
- Modify: all `apps/web` consumers and moved hook internal imports

- [ ] Update every `@/hooks/...` reference to the new direct path.
- [ ] Update the moved horizontal-overflow test to import the hook from its same directory.
- [ ] Search for the old hook paths and confirm no matches remain.

### Task 2: Group title, localization, SEO, and TMDb libraries

**Files:**
- Move title modules/tests: `apps/web/lib/title-prefetch.ts`, `apps/web/lib/title-prefetch.test.mjs`, `apps/web/lib/title-queries.ts`, and title-specific layout tests into `apps/web/lib/title/`.
- Move localization modules/tests: root `i18n.ts`, `server-localization.ts`, and any remaining root localization files into `apps/web/lib/localization/`.
- Move SEO modules/tests: `seo.ts`, `server-metadata.ts`, and metadata tests into `apps/web/lib/seo/` where their imports form one boundary.
- Move TMDb modules: `server-tmdb.ts`, `enrich-titles-palette.ts`, `image-palette.ts`, and `person-visuals.ts` into `apps/web/lib/tmdb/` only when their current dependency direction remains server-safe.
- Modify: all web consumers and relative imports affected by these moves.

- [ ] Preserve every module’s existing exports and directives.
- [ ] Update relative imports inside moved modules and tests.
- [ ] Search for all old root paths, including dynamic imports and test mocks.

### Task 3: Finish profile and infrastructure references

**Files:**
- Move remaining profile-owned root modules/tests such as monthly comparison/calendar helpers into `apps/web/lib/profile/`.
- Modify: profile components, route handlers, stores, and scripts importing moved modules.
- Modify: `apps/web/package.json` test command so nested `lib` and `hooks` tests are discovered without relying on shell glob behavior.

- [ ] Keep generic helpers (`date`, `text`, `routes`, `utils`, `query-client`, `services`, and shared browser helpers) at the root unless a concrete domain consumer proves otherwise.
- [ ] Run the web test command and confirm moved tests execute.

### Task 4: Verify the completed structure

**Files:**
- Modify only files required by failing validation.

- [ ] Search repository-wide for stale old paths and unresolved `@/hooks`/`@/lib` aliases.
- [ ] Check for duplicate filenames and empty legacy directories.
- [ ] Run `pnpm --filter @kino/web typecheck`.
- [ ] Run `pnpm --filter @kino/web lint`.
- [ ] Run `pnpm --filter @kino/web test`.
- [ ] Run `pnpm --filter @kino/web build`.
- [ ] Run the repository quality command if focused checks pass, and report unrelated failures separately.
