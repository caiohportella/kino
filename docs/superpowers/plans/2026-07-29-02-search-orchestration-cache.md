# Search Orchestration and Relationship Cache Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add application-owned person-credit orchestration with freshness/completeness-aware bounded relationship caching and TMDB fallback.

**Architecture:** Web owns the server gateway and Upstash adapter; mobile continues using the same web gateway contract. Shared core qualifies and ranks, while providers only assemble normalized evidence.

**Tech Stack:** Next.js route handlers, TMDB provider, Upstash adapters, Node tests.

## Global Constraints

- Do not place Upstash or TMDB access in shared core.
- A stale complete record is usable immediately; a missing/incomplete record may require TMDB supplementation.
- Required tests use injected fakes and never live services.

---

### Task 1: Relationship record and adapter

**Files:**
- Create: `apps/web/lib/search/person-relationships.ts`
- Create: `apps/web/lib/search/providers/person-relationship-cache.ts`
- Modify: `apps/web/lib/search/server-env.ts`
- Test: `apps/web/lib/search/person-relationships.test.mjs`
- Test: `apps/web/lib/search/providers/person-relationship-cache.test.mjs`

**Interfaces:**
- Produces: `PersonRelationshipRecord`, `evaluateRelationshipRecord()`, and `PersonRelationshipCache` with `get`/`scheduleRefresh`.
- Consumes: shared normalized person and credit contracts from Plan 1.

- [ ] **Step 1: Write failing state-machine tests**

Test missing, fresh-complete, stale-complete, fresh-incomplete, old-version, oversized, and corrupt records. Assert stale complete data returns immediately and refresh scheduling is non-blocking.

- [ ] **Step 2: Run focused tests**

Run: `pnpm --filter @kino/web test -- lib/search/person-relationships.test.mjs lib/search/providers/person-relationship-cache.test.mjs`
Expected: FAIL because the adapter is absent.

- [ ] **Step 3: Implement bounded versioned records**

Store bounded relationship summaries or IDs with `schemaVersion`, `personId`, aliases, department, separate movie/series relationships, `complete`, and `updatedAt`. Reject oversized or incompatible records without importing core indexing.

- [ ] **Step 4: Run focused tests and commit**

Run the focused command above; expect PASS.
Commit: `feat(search): add bounded person relationship cache`

### Task 2: Gateway orchestration

**Coordinator-owned files:**
- Modify: `apps/web/lib/search/gateway.ts`
- Modify: `apps/web/lib/search/providers/tmdb.ts`
- Modify: `apps/web/lib/search/observability.ts`
- Modify: `apps/web/lib/search/route-handler.ts`

**Tests:**
- `apps/web/lib/search/gateway.test.mjs`
- `apps/web/lib/search/providers/tmdb.test.mjs`
- `apps/web/lib/search/observability.test.mjs`
- `apps/web/lib/search/route-handler.test.mjs`

**Interfaces:**
- Consumes: `qualifyPersonExpansion`, `PersonRelationshipCache`, TMDB combined-credit normalization.
- Produces: shared `SearchResponseV1` only; it does not sort fused results.

- [ ] **Step 1: Add failing orchestration tests**

Assert cache-hit, stale-hit-with-refresh, incomplete-hit-with-TMDB, missing-hit, TMDB failure degradation, abort/timeout behavior, and no reordering by the gateway.

- [ ] **Step 2: Run focused gateway tests**

Run: `pnpm --filter @kino/web test -- lib/search/gateway.test.mjs lib/search/providers/tmdb.test.mjs`
Expected: FAIL on the new cache paths.

- [ ] **Step 3: Implement orchestration**

Resolve the top qualified person in shared core, read the relationship cache, fetch combined credits only when required by completeness/latency rules, schedule safe refreshes, and pass all evidence to `runSearchPipelineV1`.

- [ ] **Step 4: Verify gateway and route**

Run: `pnpm --filter @kino/web test -- lib/search/gateway.test.mjs lib/search/route-handler.test.mjs lib/search/observability.test.mjs`
Expected: PASS with no live credentials.

- [ ] **Step 5: Review gate and rollback**

Keep direct TMDB expansion coexistable behind the adapter until web and mobile consumers pass Plan 3. Rollback removes this plan's commits without changing stored user data; old cache records are ignored by schema version.

- [ ] **Step 6: Commit**

Commit: `feat(search): orchestrate cached person credit expansion`

