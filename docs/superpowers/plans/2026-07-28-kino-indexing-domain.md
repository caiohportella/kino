# Kino Shared Indexing Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define pure versioned search-index documents, stable content hashes, and incremental indexing decisions without building a worker or provider integration.

**Architecture:** `packages/core/src/indexing` transforms normalized media/person inputs into provider-neutral documents. Search never imports it; server adapters or future workers consume it.

**Tech Stack:** TypeScript, Web Crypto-compatible pure hashing input, Node test runner.

## Global Constraints

- Category 1 and stable Category 4 search contracts must already exist.
- Use a dedicated indexing worktree.
- Do not edit search ranking or pipeline modules.
- No provider SDK, environment, TMDB fetch, scheduler, worker, storage, React, Next.js, Expo, or Supabase imports.
- Coordinator owns shared exports and manifests.

---

### Task 1: Versioned Index Contracts

**Files:**
- Create: `packages/core/src/indexing/types.ts`
- Create: `packages/core/src/indexing/version.ts`
- Create: `packages/core/src/indexing/version.test.mjs`
- Create: `packages/core/src/indexing/index.ts`
- Modify (coordinator): `packages/core/src/index.ts`

**Interfaces:**
- Produces: `SEARCH_INDEX_SCHEMA_VERSION = 1`
- Produces: `SearchIndexDocumentV1`, `SearchIndexMetadataV1`
- Produces normalized movie, series, and person indexing inputs.

- [ ] **Step 1: Write failing schema tests**

Assert movie/person literal metadata shapes and that the version is serialized into documents.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing indexing modules.

- [ ] **Step 3: Implement plain immutable contracts**

Keep index version independent from search response schema.

- [ ] **Step 4: Verify GREEN**

Run core tests.

- [ ] **Step 5: Commit**

```text
feat[indexing]: define versioned index documents

Add provider-neutral title and person document contracts independent from search responses.
```

### Task 2: Searchable Text and Metadata Builder

**Files:**
- Create: `packages/core/src/indexing/documents.ts`
- Create: `packages/core/src/indexing/documents.test.mjs`

**Interfaces:**
- Produces: `buildSearchIndexDocumentV1(input): SearchIndexDocumentV1`
- Produces canonical searchable text from normalized titles, alternatives, people, relationships, genres, keywords, franchise, and locale.

- [ ] **Step 1: Write failing literal document tests**

Use a complete hand-authored expected Godfather document. Test malformed relationships and absent optional metadata.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing builder.

- [ ] **Step 3: Implement deterministic composition**

Sort unordered sets, preserve meaningful cast order, normalize whitespace, and exclude secret/provider fields.

- [ ] **Step 4: Verify GREEN**

Shuffled equivalent input must produce byte-identical searchable text and metadata.

- [ ] **Step 5: Commit**

```text
feat[indexing]: build deterministic search documents

Normalize media and relationship metadata into stable provider-neutral indexing payloads.
```

### Task 3: Stable Content Hashes

**Files:**
- Create: `packages/core/src/indexing/content-hash.ts`
- Create: `packages/core/src/indexing/content-hash.test.mjs`

**Interfaces:**
- Produces: `canonicalizeIndexDocument`
- Produces: `createIndexContentHash(input): Promise<string>`

- [ ] **Step 1: Write failing hash tests**

Assert equivalent key/input order yields a known SHA-256 fixture; changed title, relationship, or index version changes the hash.

- [ ] **Step 2: Verify RED**

Run core tests; expect missing hash functions.

- [ ] **Step 3: Implement canonical serialization and SHA-256**

Hash the normalized provider-neutral content, never runtime timestamps.

- [ ] **Step 4: Verify GREEN**

Run tests in Node and typecheck DOM-compatible usage.

- [ ] **Step 5: Commit**

```text
feat[indexing]: add stable document content hashes

Support deterministic incremental indexing decisions without provider or worker coupling.
```

### Task 4: Incremental Index Decisions and Boundary Enforcement

**Files:**
- Create: `packages/core/src/indexing/incremental.ts`
- Create: `packages/core/src/indexing/incremental.test.mjs`
- Create: `scripts/check-domain-boundaries.mjs`
- Create: `scripts/check-domain-boundaries.test.mjs`

**Interfaces:**
- Produces: `decideIndexMutation(previous, next): 'skip' | 'upsert' | 'delete'`
- Boundary checker rejects forbidden imports and search/indexing cross-dependencies.

- [ ] **Step 1: Write failing mutation and boundary tests**

Assert equal hash skips, changed hash upserts, missing next deletes, and forbidden synthetic imports produce nonzero boundary results.

- [ ] **Step 2: Verify RED**

Run core and script tests; expect missing APIs.

- [ ] **Step 3: Implement pure decisions and dependency checker**

The checker parses static imports; it does not grep comments or prose.

- [ ] **Step 4: Verify GREEN**

Run tests and `node scripts/check-domain-boundaries.mjs`.
Expected: pass for repository source.

- [ ] **Step 5: Review and commit**

Specification review: indexing has no search side effects or provider writes.
Quality review: hashes and decisions are deterministic.

```text
feat[indexing]: define incremental indexing boundaries

Skip unchanged documents and enforce platform-neutral search/indexing dependency direction.
```

## Category Verification

Run core tests/typecheck, boundary checker, lint, and:

```text
rg "@upstash|process\\.env|next/|expo-|react|supabase|fetch\\(" packages/core/src/indexing
```

Expected: no forbidden imports/calls and all commands pass.

