# Kino Testing and CI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the mandatory test and CI gate that every later Kino reliability category must pass.

**Architecture:** Retain Node's built-in test runner and add executable contract tests plus one GitHub Actions workflow. Root script and shared configuration edits are coordinator-owned; the category agent owns tests and workflow content.

**Tech Stack:** pnpm 11, Node 22 test runner, TypeScript 5.9, Biome 2, GitHub Actions, Next.js build.

## Global Constraints

- Category 1 lands before production behavior migrations.
- Do not connect CI to production Supabase, Upstash, Redis, or TMDB.
- Do not introduce Vitest.
- Root manifests, lockfiles, and shared configuration are coordinator-owned.
- Every task uses TDD, specification review, code-quality review, and fresh verification.
- No recommendations, workers, offline sync, or database migrations.

---

### Task 1: Root Validation Contract

**Files:**
- Create: `scripts/validate-test-scripts.mjs`
- Create: `scripts/validate-test-scripts.test.mjs`
- Modify (coordinator): `package.json`

**Interfaces:**
- Produces: `validateWorkspaceScripts(root: string): Promise<ValidationResult>`
- Produces root script: `"test": "pnpm -r --if-present test"`
- Produces root script: `"check": "pnpm biome check . && pnpm lint && pnpm typecheck && pnpm test && pnpm build:web"`
- `pnpm test` executes the `apps/mobile`, `apps/web`, and `packages/core`
  test scripts through the pnpm workspace.

- [ ] **Step 1: Write the failing script-contract test**

```js
test('rejects a workspace package missing a test script', async () => {
  const result = await validateWorkspaceScripts(fixtureRoot('missing-test'))
  assert.deepEqual(result.missing, ['apps/web'])
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/validate-test-scripts.test.mjs`
Expected: FAIL because `validate-test-scripts.mjs` does not exist.

- [ ] **Step 3: Implement manifest discovery and literal missing-script output**

Implement JSON parsing for root workspace globs and package manifests. Do not invoke package scripts from the validator.

- [ ] **Step 4: Run GREEN and mutation check**

Run: `node --test scripts/validate-test-scripts.test.mjs`
Expected: PASS. Removing one fixture `test` script must make the test fail.

- [ ] **Step 5: Coordinator adds root scripts and verifies them**

Run: `pnpm test`
Expected: `@kino/mobile`, `@kino/web`, and `@kino/core` configured suites run.

- [ ] **Step 6: Commit**

```text
test[quality]: define monorepo validation contract

Add executable workspace script validation and root test/check entry points.
```

### Task 2: Cross-Domain Test Fixtures

**Files:**
- Create: `packages/core/src/testing/provider-fixtures.ts`
- Create: `packages/core/src/testing/provider-fixtures.test.mjs`
- Modify (coordinator): `packages/core/src/index.ts`

**Interfaces:**
- Produces: complete literal fixtures for normalized movie, series, person, semantic candidate, and TMDB fallback inputs.
- Fixtures contain no SDK instances, credentials, network calls, or expectation builders.

- [ ] **Step 1: Write failing completeness tests**

```js
test('person fixture includes every normalized relationship field', () => {
  assert.deepEqual(personFixture.people[0], {
    id: 3084,
    name: 'Marlon Brando',
    role: 'cast',
    character: 'Don Vito Corleone',
    order: 0,
  })
})
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @kino/core test`
Expected: FAIL because fixture exports are absent.

- [ ] **Step 3: Add hand-authored complete fixtures**

Keep expected values literal; do not derive expected scores, hashes, or keys with production helpers.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @kino/core test`
Expected: all core tests pass.

- [ ] **Step 5: Commit**

```text
test[core]: add provider boundary fixtures

Provide complete plain-data fixtures for later auth, cache, search, and gateway regression tests.
```

### Task 3: GitHub Actions Quality Gate

**Files:**
- Create: `.github/workflows/quality.yml`
- Create: `scripts/validate-workflow.mjs`
- Create: `scripts/validate-workflow.test.mjs`

**Interfaces:**
- CI runs frozen install, Biome check, lint, typecheck, test, and web build.
- CI concurrency key: `${{ github.workflow }}-${{ github.ref }}`
- CI permissions: `contents: read`

- [ ] **Step 1: Write failing workflow behavior test**

```js
test('quality workflow exposes every required command in order', async () => {
  assert.deepEqual(await readRunCommands(workflowPath), [
    'pnpm install --frozen-lockfile',
    'pnpm biome check .',
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build:web',
  ])
})
```

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/validate-workflow.test.mjs`
Expected: FAIL because the workflow is absent.

- [ ] **Step 3: Add workflow and validator**

Use `actions/checkout`, `pnpm/action-setup`, and `actions/setup-node` with pnpm cache. Do not define production secrets.

- [ ] **Step 4: Verify workflow contract**

Run: `node --test scripts/validate-workflow.test.mjs`
Expected: PASS, including concurrency cancellation and read-only permissions.

- [ ] **Step 5: Run local CI equivalent**

Run: `pnpm biome check . && pnpm lint && pnpm typecheck && pnpm test && pnpm build:web`
Expected: exit 0; the production Next.js build succeeds and every Open Graph
bundle check reports PASS.

- [ ] **Step 6: Review gates**

Specification review: confirm exact command coverage and no production credentials.
Quality review: confirm tests execute workflow semantics rather than grep exact prose.

- [ ] **Step 7: Commit**

```text
ci[quality]: validate monorepo pull requests

Run frozen-install, formatting, lint, type, test, and production web build gates with obsolete-run cancellation.
```

## Category Verification

Run fresh:

```text
pnpm biome check .
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web
git diff --check
```

Expected: every command exits 0. `pnpm build:web` includes the repository's
Open Graph bundle checks. Category 1 must be integrated before any later
category worktree is created.
