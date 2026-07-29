# Validation, Migration, Rollout, and Legacy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove every migration, preserve rollback paths, remove only verified legacy code, and produce the required evidence-backed final report.

**Architecture:** Verification is deterministic and external-service-free in CI; optional live checks supplement but never replace fixtures.

**Tech Stack:** Biome, TypeScript, Node tests, Next.js production build, application accessibility and responsive test infrastructure.

## Global Constraints

- Do not remove a legacy path until all consumers pass focused and repository-wide verification.
- Required checks never require live TMDB or Upstash.
- Cross-session persistence stays deferred and documented.

---

### Task 1: Boundary, regression, and accessibility gates

**Files:**
- Modify: `scripts/validate-test-scripts.mjs`
- Create: `scripts/architecture-boundaries.test.mjs`
- Modify: relevant focused tests from Plans 1-6.

- [ ] Add failing boundary checks for forbidden core imports, search/indexing cross-imports, application-owned providers, and shared-core-exclusive ranking.
- [ ] Run `node --test scripts/*.test.mjs`; expect FAIL before enforcement is wired.
- [ ] Add deterministic responsive, accessibility, injected-provider, request-count, cache-collision, and mutation-scope tests to the repository test manifest.
- [ ] Run `pnpm test`; expect PASS with no external credentials.
- [ ] Commit: `test(quality): enforce search and profile boundaries`

### Task 2: Consumer migration audit and legacy removal

**Coordinator-owned files:**
- `apps/web/app/search/page.tsx`
- `apps/web/lib/search/gateway.ts`
- `apps/mobile/app/(tabs)/search.tsx`
- `apps/web/components/profile-view.tsx`
- `apps/mobile/hooks/profile/useProfileData.ts`
- `apps/mobile/app/profile/[id].tsx`

- [ ] Audit with `rg "vote_average:\\s*(result\\.score|score)|queryKey:\\s*\\['profile'|refreshSeriesAvailability|Promise\\.all\\(" apps packages` and record every remaining legacy consumer.
- [ ] Run focused legacy-consumer assertions; expect FAIL while any unverified path remains.
- [ ] Remove only migrated raw search adapters, monolithic profile aggregation, full-library season fan-out, and broad profile invalidations.
- [ ] Re-run the audit; expect no prohibited matches and preserve intentional unrelated `Promise.all` usage.
- [ ] Commit: `refactor: remove verified search and profile legacy paths`

### Task 3: Full verification and rollback proof

- [ ] Run `pnpm biome check .`; expect exit 0.
- [ ] Run `pnpm lint`; expect exit 0.
- [ ] Run `pnpm typecheck`; expect exit 0.
- [ ] Run `pnpm test`; expect exit 0 with all focused suites included.
- [ ] Run `pnpm build:web`; expect exit 0.
- [ ] Run available automated accessibility and responsive visual commands identified in the repository; expect no regressions.
- [ ] Verify rollback at each commit boundary by confirming no schema/database migration is required and previous consumer commits remain independently revertible.
- [ ] Optionally run live Ryan Gosling, Michael C. Hall, Marlon Brando, Pedro Pascal, Sofia Coppola, and Christopher Nolan queries when credentials/network permit; label results optional.

### Task 4: Final evidence report

- [ ] Record all changed files, root causes, rating source, adapter behavior, skeleton capacity calculation, review geometry, and mobile alignment.
- [ ] Show original and final profile request graphs; identify the only remaining blocking data.
- [ ] Report query factories/policies, progressive sections, previous-data behavior, prefetch triggers, invalidation scopes, candidate window, maximum season concurrency, structural before/after TMDB request counts, optional live measurements, and remaining risks.
- [ ] State that cross-session persistence is deferred with the safety requirements from the design.
- [ ] Review gate: do not claim completion unless every required command has fresh successful output; disclose any failure or unavailable optional validation.
- [ ] Commit final documentation only if repository conventions require a checked-in report: `docs: report search and profile migration verification`.

