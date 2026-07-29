# Shared Search Contracts and Relationship Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shared core the single source of truth for person qualification, credit evidence, bounded scoring, fusion, ranking, deduplication, and normalized search presentation contracts.

**Architecture:** Extend the existing `packages/core/src/search` pipeline without importing providers or indexing. Relationship evidence is consolidated before fusion; applications provide evidence and consume normalized results.

**Tech Stack:** TypeScript, Node test runner, `@kino/core`.

## Global Constraints

- Do not import React, Next.js, Expo, Supabase, Upstash, environment modules, or `src/indexing` from shared search.
- Do not expose relevance as a display rating; missing ratings remain absent.
- Preserve schema compatibility through an explicit search schema-version change and deterministic normalization.

---

### Task 1: Versioned score and presentation contracts

**Files:**
- Modify: `packages/core/src/search/types.ts`
- Modify: `packages/core/src/search/normalize.ts`
- Modify: `packages/core/src/search/index.ts`
- Test: `packages/core/src/search/normalize.test.mjs`

**Interfaces:**
- Produces: `CreditSearchScore`, enriched `SearchEntity`, `SearchTitleCardModel`, `SearchPersonModel`, and a bumped `SEARCH_SCHEMA_VERSION`.
- Consumes: existing `SearchRequestV1`, provider candidates, and `SearchResponseV1`.

- [ ] **Step 1: Write failing contract tests**

Assert that provider score inputs are bounded, `tmdbVoteAverage: null` remains null, relevance cannot populate `displayRating`, and the new schema rejects the previous response shape.

- [ ] **Step 2: Run the focused test**

Run: `pnpm --filter @kino/core test -- src/search/normalize.test.mjs`
Expected: FAIL because the new fields and schema semantics do not exist.

- [ ] **Step 3: Add explicit contracts and normalization**

Add bounded score components and nullable rating fields. Normalize provider-native scores once and keep presentation rating independent:

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

Cover Ryan Gosling, Michael C. Hall, Marlon Brando, Pedro Pascal, Sofia Coppola, and Christopher Nolan in exact and relationship wording. Assert strong relationships survive low semantic scores, distinct Dexter entities remain, and weak duplicate evidence cannot suppress a strong credit.

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

Confirm existing exact-title and user grouping fixtures are unchanged apart from the schema version. Rollback is the two commits in this plan; no data migration occurs and applications remain on the prior schema until Plan 2.

- [ ] **Step 8: Commit**

Commit: `feat(search): rank person relationships in shared core`

