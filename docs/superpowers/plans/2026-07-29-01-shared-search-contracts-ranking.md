# Shared Search Contracts and Relationship Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shared core the single source of truth for person qualification, credit evidence, bounded scoring, fusion, ranking, deduplication, and normalized V2 search presentation contracts while retaining V1 compatibility.

**Architecture:** Extend the existing `packages/core/src/search` pipeline without importing providers or indexing. Relationship evidence is consolidated before fusion; applications provide evidence and consume normalized results.

**Tech Stack:** TypeScript, Node test runner, `@kino/core`.

## Global Constraints

- Do not import React, Next.js, Expo, Supabase, Upstash, environment modules, or `src/indexing` from shared search.
- Do not expose relevance as a display rating; missing ratings remain absent.
- Add V2 without deleting or renaming V1; V1 remains supported until both consumers migrate and rollback is verified.
- Coordinator integration follows `2026-07-29-00-execution-order-and-ownership.md`.

---

### Task 1: Versioned score and presentation contracts

**Files:**
- Modify: `packages/core/src/search/types.ts`
- Modify: `packages/core/src/search/normalize.ts`
- Modify: `packages/core/src/search/index.ts`
- Test: `packages/core/src/search/normalize.test.mjs`

**Interfaces:**
- Produces: `CreditSearchScore`, V2 search entities/presentation fields, `SearchRequestV2`, `SearchResponseV2`, and V1/V2 compatibility unions.
- Consumes: unchanged `SearchRequestV1`, `SearchResponseV1`, and provider candidates.

- [ ] **Step 1: Write failing contract tests**

Assert explicit below/above-range behavior, rejection of `NaN` and infinity, neutral vote confidence without vote counts, nullable TMDB ratings, and no relevance-to-rating mapping. V2 rejects malformed V2 while the compatibility parser recognizes supported V1.

- [ ] **Step 2: Run the focused test**

Run: `pnpm --filter @kino/core test -- src/search/normalize.test.mjs`
Expected: FAIL because the new fields and schema semantics do not exist.

- [ ] **Step 3: Add explicit contracts and normalization**

Add V2 bounded score components and nullable rating fields without changing V1. Normalize provider-native scores once and keep presentation rating independent:

```ts
export interface CreditSearchScore {
  readonly relationshipScore: number
  readonly semanticScore: number
  readonly popularityScore: number
  readonly voteConfidenceScore: number
  readonly castOrderScore: number
}
```

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @kino/core test -- src/search/normalize.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat(search): version explicit search score contracts`

### Task 2: Shared person qualification and deterministic credit consolidation

**Files:**
- Create: `packages/core/src/search/person-qualification.ts`
- Modify: `packages/core/src/search/person-expansion.ts`
- Modify: `packages/core/src/search/fusion.ts`
- Modify: `packages/core/src/search/rank.ts`
- Modify: `packages/core/src/search/pipeline.ts`
- Test: `packages/core/src/search/person-qualification.test.mjs`
- Test: `packages/core/src/search/person-expansion.test.mjs`
- Test: `packages/core/src/search/fusion.test.mjs`
- Test: `packages/core/src/search/rank.test.mjs`
- Test: `packages/core/src/search/pipeline.test.mjs`

**Interfaces:**
- Produces: `qualifyPersonExpansion(query, evidence)`, deterministic entity evidence consolidation, bounded component ranking.
- Consumes: contracts from Task 1.

- [ ] **Step 1: Add failing fixtures**

Cover Ryan Gosling, Michael C. Hall, Marlon Brando, Pedro Pascal, Sofia Coppola, and Christopher Nolan in exact and relationship wording. Assert strong relationships survive low semantic scores, popularity cannot rescue unrelated candidates, missing vote counts remain neutral, distinct Dexter entities remain, weak evidence cannot suppress a strong credit, and reversed/shuffled evidence ranks identically.

- [ ] **Step 2: Run search tests**

Run: `pnpm --filter @kino/core test -- src/search/*.test.mjs`
Expected: FAIL on qualification and component ranking assertions.

- [ ] **Step 3: Implement qualification and ranking**

Keep qualification threshold semantics in core, apply evidence penalties before consolidation, dedupe by `${mediaType}:${tmdbId}`, and send every source through shared fusion/ranking without application reordering.

- [ ] **Step 4: Verify deterministic output**

Run: `pnpm --filter @kino/core test -- src/search/*.test.mjs`
Expected: PASS for forward, reversed, and shuffled evidence.

- [ ] **Step 5: Add architectural boundary test**

Create `packages/core/src/search/architecture.test.mjs` that scans imports and rejects framework/provider/indexing imports and reciprocal search/indexing imports.

- [ ] **Step 6: Run core verification**

Run: `pnpm --filter @kino/core typecheck && pnpm --filter @kino/core test`
Expected: PASS.

- [ ] **Step 7: Review gate and rollback**

Confirm existing V1 exact-title and user grouping fixtures remain compatible. Rollback is the two commits in this plan; applications remain on V1 until Plans 2 and 3 opt into V2.

- [ ] **Step 8: Commit**

Commit: `feat(search): rank person relationships in shared core`
