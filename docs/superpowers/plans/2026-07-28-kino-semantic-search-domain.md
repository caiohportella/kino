# Kino Shared Semantic Search Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement versioned, deterministic, provider-neutral search intent, expansion, fusion, ranking, deduplication, and grouping in shared core.

**Architecture:** `packages/core/src/search` receives plain candidates and owns every ordering rule. It performs no network, environment, provider SDK, React, Next.js, or Expo work.

**Tech Stack:** TypeScript, Node test runner, plain immutable data.

## Global Constraints

- Category 1 must already pass.
- Work in an isolated search-core worktree.
- Do not edit indexing modules, routes, clients, auth, or localization implementation.
- Coordinator owns `packages/core/src/index.ts`, manifests, and lockfiles.
- Ranking is exclusively owned here.
- Search schema version is independent from endpoint and cache schema versions.

---

### Task 1: Versioned Search Contracts and Normalization

**Files:**
- Create: `packages/core/src/search/types.ts`
- Create: `packages/core/src/search/normalize.ts`
- Create: `packages/core/src/search/normalize.test.mjs`
- Create: `packages/core/src/search/index.ts`
- Modify (coordinator): `packages/core/src/index.ts`

**Interfaces:**
- Produces: `SEARCH_SCHEMA_VERSION = 1`
- Produces: `SearchRequestV1`, `SearchResponseV1`, `SearchResultV1`
- Produces: `SemanticCandidate`, `LexicalCandidate`, `PersonCandidate`, `SearchProviderResult`
- Produces: `normalizeSearchQuery`, `normalizeProviderCandidate`

- [ ] **Step 1: Write failing normalization and compatibility tests**

```js
assert.deepEqual(normalizeSearchQuery('  Amélie   2001 '), {
  original: 'Amélie 2001',
  folded: 'amelie 2001',
  tokens: ['amelie', '2001'],
  year: 2001,
})
```

Cover additive optional response fields and rejection of an unsupported request schema.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing search modules.

- [ ] **Step 3: Implement contracts and normalization**

No provider-specific fields may appear in normalized contracts.

- [ ] **Step 4: Verify GREEN**

Run core tests; accent, case, whitespace, year, empty, and malformed candidates pass.

- [ ] **Step 5: Commit**

```text
feat[search]: define versioned search contracts

Add provider-neutral requests, responses, candidates, and lexical normalization in shared core.
```

### Task 2: Intent Detection

**Files:**
- Create: `packages/core/src/search/intent.ts`
- Create: `packages/core/src/search/intent.test.mjs`

**Interfaces:**
- Produces: `detectSearchIntent(query, evidence): SearchIntent`
- Intents: exact title, title year, person, relationship, franchise, semantic discovery, ambiguous.

- [ ] **Step 1: Write failing table cases**

Use literal expectations for `Marlon Brando`, `movies with Marlon Brando`, `films directed by Sofia Coppola`, `shows starring Pedro Pascal`, `Alien 1979`, and `space horror from the 1980s`.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing detector.

- [ ] **Step 3: Implement lightweight deterministic detection**

Relationship phrases constrain role/media type. Provider person confidence is input, not fetched here.

- [ ] **Step 4: Verify GREEN**

Run tests and mutate the person-confidence threshold locally to prove boundary cases fail.

- [ ] **Step 5: Commit**

```text
feat[search]: detect title person and discovery intent

Classify normalized queries and relationship constraints without provider coupling.
```

### Task 3: Person Expansion Rules

**Files:**
- Create: `packages/core/src/search/person-expansion.ts`
- Create: `packages/core/src/search/person-expansion.test.mjs`

**Interfaces:**
- Produces: `expandPersonCredits(person, credits, intent): RelationshipCandidate[]`
- Does not fetch credits.

- [ ] **Step 1: Write failing ranking-input tests**

Actors prioritize low cast order and acting roles; directors prioritize directing; creators prioritize creator credits; self/archive footage receives a penalty.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing expansion function.

- [ ] **Step 3: Implement expansion and deduplication**

Deduplicate by media type and TMDB ID before returning relationship candidates.

- [ ] **Step 4: Verify GREEN**

Run tests with shuffled credit input; output must remain stable.

- [ ] **Step 5: Commit**

```text
feat[search]: expand person relationships deterministically

Convert cast and crew credits into role-aware title candidates without network access.
```

### Task 4: Score Normalization, Fusion, and Ranking

**Files:**
- Create: `packages/core/src/search/rank.ts`
- Create: `packages/core/src/search/rank.test.mjs`
- Create: `packages/core/src/search/fusion.ts`
- Create: `packages/core/src/search/fusion.test.mjs`

**Interfaces:**
- Produces: `normalizeProviderScore`
- Produces: `rankSearchCandidates(input): RankedSearchResult[]`
- Produces: `fuseSearchCandidates(sources): FusedCandidate[]`

- [ ] **Step 1: Write failing weighted-ranking tests**

Assert exact title-year beats broad semantics, high-confidence person expansion beats text mentions, popularity cannot rescue irrelevant results, duplicates merge source evidence, and ties use stable entity identity.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing rank/fusion APIs.

- [ ] **Step 3: Implement bounded score components**

Expose named weights in shared core. Do not export mutable weight objects.

- [ ] **Step 4: Verify GREEN**

Run table tests twice with reversed inputs and assert identical order.

- [ ] **Step 5: Commit**

```text
feat[search]: centralize hybrid fusion and ranking

Combine lexical, semantic, relationship, locale, and bounded popularity evidence with stable ordering.
```

### Task 5: Canonical Pipeline

**Files:**
- Create: `packages/core/src/search/pipeline.ts`
- Create: `packages/core/src/search/pipeline.test.mjs`

**Interfaces:**
- Produces: `runSearchPipelineV1(input): SearchResponseV1`
- Consumes already fetched and normalized candidates.
- Orders: expand, normalize scores, fuse, rank, dedupe, group, trim.

- [ ] **Step 1: Write failing end-to-end pure pipeline tests**

Assert grouped Marlon Brando results, identical mobile/web response ordering for identical inputs, zero results, pagination trimming, and schema version output.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing pipeline.

- [ ] **Step 3: Implement orchestration using only shared functions**

Do not import indexing modules. Presentation localization fields are supplied by gateway inputs and cannot reorder results.

- [ ] **Step 4: Verify GREEN**

Run all core search tests.

- [ ] **Step 5: Review and commit**

Specification review: every ranking rule is shared-core owned.
Quality review: no provider, platform, environment, or indexing imports.

```text
feat[search]: compose canonical shared search pipeline

Return deterministic grouped versioned responses from normalized provider candidates.
```

## Category Verification

Run `pnpm --filter @kino/core test`, core typecheck, repository lint, and dependency scan:

```text
rg "@upstash|process\\.env|next/|expo-|react|supabase" packages/core/src/search
```

Expected: tests/typecheck/lint pass and scan returns no imports.

