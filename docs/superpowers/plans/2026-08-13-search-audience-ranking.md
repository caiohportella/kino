# Kino Search Audience-Relevance Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make strongly matching media titles compete by dampened audience prominence while keeping weak textual matches below strong matches and keeping the hero selector consistent with title ranking.

**Architecture:** Add shared, UI-independent title-ranking primitives to `@kino/core/search`. The core ranker will use them only for movie/series candidates, while people, users, relationships, and existing fallback behavior retain their current ranking path. The web featured-title selector will consume the same tier and audience helpers so it no longer maintains a conflicting scoring formula.

**Tech Stack:** TypeScript, `@kino/core/search`, Node built-in test runner with `--experimental-strip-types`, Next.js web package, Biome.

## Global Constraints

- Preserve Redis Search, smart/fuzzy/prefix retrieval, localized title matching, autocomplete, caret behavior, TMDb fallback, deduplication, and the existing search UI.
- Do not use Redis `orderBy` popularity; preserve text relevance.
- Vote count must influence audience prominence more than popularity; use logarithmic/dampened values.
- Treat missing `voteCount`, `popularity`, and `voteAverage` as neutral values without throwing.
- Do not change the unified Redis schema or recreate `kino-search`; the existing schema already indexes the required numeric fields.
- Do not apply media-title audience ranking to users or people.
- Preserve unrelated dirty-worktree changes.

---

### Task 1: Add shared title match tiers and audience scoring

**Files:**
- Create: `packages/core/src/search/title-ranking.ts`
- Test: `packages/core/src/search/title-ranking.test.mjs`
- Modify: `packages/core/src/search/index.ts`

**Interfaces:**

```ts
export type TitleMatchTier = 'strong' | 'medium' | 'fuzzy' | 'weak'

export interface TitleRankingEvidence {
  readonly exactMatch?: boolean
  readonly prefixMatch?: boolean
  readonly lexicalScore?: number
  readonly semanticScore?: number
}

export interface TitleAudienceMetrics {
  readonly voteCount?: number | null
  readonly popularity?: number | null
  readonly voteAverage?: number | null
}

export interface TitleRankingSignals {
  readonly tier: TitleMatchTier
  readonly audienceScore: number
  readonly textScore: number
  readonly voteAverage: number
}

export function classifyTitleMatch(evidence: TitleRankingEvidence): TitleMatchTier
export function titleAudienceScore(metrics: TitleAudienceMetrics): number
export function titleRankingSignals(
  evidence: TitleRankingEvidence,
  metrics: TitleAudienceMetrics
): TitleRankingSignals
export function compareTitleRankingSignals(
  left: TitleRankingSignals,
  right: TitleRankingSignals
): number
```

- [ ] **Step 1: Write failing tests for tier classification.**

```js
test('puts exact and prefix evidence in the strong title band', () => {
  assert.equal(classifyTitleMatch({ exactMatch: true }), 'strong')
  assert.equal(classifyTitleMatch({ prefixMatch: true }), 'strong')
  assert.equal(classifyTitleMatch({ lexicalScore: 0.85 }), 'strong')
})

test('keeps ordinary, fuzzy, and absent evidence below strong', () => {
  assert.equal(classifyTitleMatch({ lexicalScore: 0.65 }), 'medium')
  assert.equal(classifyTitleMatch({ semanticScore: 0.4 }), 'fuzzy')
  assert.equal(classifyTitleMatch({}), 'weak')
})
```

- [ ] **Step 2: Write failing tests for dampened audience prominence.**

```js
test('weights vote count more than popularity and ignores rating as primary audience evidence', () => {
  const broad = titleAudienceScore({ voteCount: 30_000, popularity: 30, voteAverage: 8.2 })
  const highlyRated = titleAudienceScore({ voteCount: 12, popularity: 30, voteAverage: 9.1 })
  assert.ok(broad > highlyRated)
})

test('handles missing and invalid audience metrics neutrally', () => {
  assert.equal(titleAudienceScore({}), 0)
  assert.equal(titleAudienceScore({ voteCount: Number.NaN, popularity: -4 }), 0)
})
```

- [ ] **Step 3: Write failing tests for same-tier comparison.**

```js
test('audience prominence reorders comparable strong matches', () => {
  const obscure = titleRankingSignals(
    { exactMatch: true, lexicalScore: 1 },
    { voteCount: 100, popularity: 2 }
  )
  const recognized = titleRankingSignals(
    { prefixMatch: true, lexicalScore: 0.92 },
    { voteCount: 20_000, popularity: 300 }
  )
  assert.ok(compareTitleRankingSignals(recognized, obscure) < 0)
})

test('a weak fuzzy match cannot beat a strong match through popularity', () => {
  const strong = titleRankingSignals(
    { prefixMatch: true, lexicalScore: 0.9 },
    { voteCount: 20, popularity: 1 }
  )
  const fuzzy = titleRankingSignals(
    { semanticScore: 0.4 },
    { voteCount: 500_000, popularity: 1_000_000 }
  )
  assert.ok(compareTitleRankingSignals(strong, fuzzy) < 0)
})
```

- [ ] **Step 4: Run the new test file and verify RED.**

Run from `packages/core`:

```powershell
node --test --experimental-strip-types src/search/title-ranking.test.mjs
```

Expected: failure because `title-ranking.ts` and its exports do not exist yet.

- [ ] **Step 5: Implement the minimal shared ranking helpers.**

Use finite non-negative metrics and logarithmic dampening. A concrete starting formula is:

```ts
const audienceScore =
  Math.log1p(Math.max(0, finiteOrZero(voteCount))) * 0.75 +
  Math.log1p(Math.max(0, finiteOrZero(popularity))) * 0.25
```

Normalize only as needed for stable comparison. `compareTitleRankingSignals` must compare tier first, audience within the same strong tier, then text score, then vote average. Lower-ranked tiers must never be rescued by audience alone.

- [ ] **Step 6: Export the helpers and rerun the focused tests.**

Run:

```powershell
node --test --experimental-strip-types src/search/title-ranking.test.mjs
```

Expected: all new tests pass.

### Task 2: Apply title-specific ranking in the shared core pipeline

**Files:**
- Modify: `packages/core/src/search/rank.ts`
- Modify: `packages/core/src/search/rank.test.mjs`
- Test: `packages/core/src/search/pipeline.test.mjs` when a pipeline-level assertion is needed

**Interfaces:**

- `rankSearchCandidates` continues accepting `RankSearchCandidatesInput` and returning `RankedSearchResult[]`.
- Only candidates with `entity.entityType === 'movie' || entity.entityType === 'series'` use title-specific tier/audience ordering.
- People, users, relationship candidates, and existing stable identity ordering retain their existing behavior.

- [ ] **Step 1: Add failing regression tests for Duna and Obsession.**

```js
test('audience-recognized Duna wins within the strong title band', () => {
  const results = rank('duna', [
    { source: 'lexical', entity: entity(2018, 'Duna', { year: 2018, voteCount: 100, popularity: 2 }), lexicalScore: 1, exactMatch: true },
    { source: 'lexical', entity: entity(2021, 'Duna', { year: 2021, voteCount: 30_000, popularity: 500 }), lexicalScore: 0.92, prefixMatch: true },
  ])
  assert.equal(results[0].entity.tmdbId, 2021)
})

test('audience-recognized Obsession wins over an obscure same-tier exact title', () => {
  const results = rank('obsession', [
    { source: 'lexical', entity: entity(1976, 'Obsession', { voteCount: 80, popularity: 1 }), lexicalScore: 1, exactMatch: true },
    { source: 'lexical', entity: entity(2019, 'Obsession', { voteCount: 12_000, popularity: 120 }), lexicalScore: 0.95, prefixMatch: true },
  ])
  assert.equal(results[0].entity.tmdbId, 2019)
})
```

- [ ] **Step 2: Add protection tests for textual relevance and fuzzy results.**

Cover:

```js
test('unrelated blockbuster does not beat a relevant Godfather title', () => {
  const results = rank('godfather', [
    { source: 'semantic', entity: entity(1, 'The Godfather', { voteCount: 2_000 }), semanticScore: 0.8 },
    { source: 'semantic', entity: entity(2, 'Unrelated Blockbuster', { voteCount: 500_000, popularity: 1_000_000 }), semanticScore: 0.1 },
  ])
  assert.equal(results[0].entity.title, 'The Godfather')
})

test('popular weak fuzzy result does not beat a strong prefix result', () => {
  const results = rank('oppen', [
    { source: 'lexical', entity: entity(3, 'Oppenheimer', { voteCount: 300 }), lexicalScore: 0.9, prefixMatch: true },
    { source: 'semantic', entity: entity(4, 'Popular Unrelated Film', { voteCount: 500_000, popularity: 1_000_000 }), semanticScore: 0.35 },
  ])
  assert.equal(results[0].entity.title, 'Oppenheimer')
})

test('vote count beats a high rating when text evidence is comparable', () => {
  const results = rank('dune', [
    { source: 'lexical', entity: entity(5, 'Dune', { voteCount: 12, popularity: 10 }), lexicalScore: 0.95, exactMatch: true },
    { source: 'lexical', entity: entity(6, 'Dune', { voteCount: 30_000, popularity: 10 }), lexicalScore: 0.94, prefixMatch: true },
  ])
  assert.equal(results[0].entity.tmdbId, 6)
})
```

Use real `rankSearchCandidates` output and existing `fuseSearchCandidates` helpers rather than testing only internal numbers.

- [ ] **Step 3: Run the focused rank tests and verify RED.**

Run from `packages/core`:

```powershell
node --test --experimental-strip-types src/search/rank.test.mjs src/search/title-ranking.test.mjs
```

Expected: the new Duna/Obsession assertions fail against the current exact-match weighting.

- [ ] **Step 4: Integrate shared signals into `rank.ts`.**

For movie and series candidates, compute `titleRankingSignals` from candidate evidence and entity audience fields. Use a title-specific score/key that preserves the tier boundary and allows audience prominence to reorder only comparable strong candidates. Keep the current weighted scoring path for non-title candidates.

Do not remove the existing `SearchScoreComponents` fields or change the V1/V2 response shape. If `components.popularity` remains the serialized audience component, keep it bounded and document the meaning in code; do not introduce a popularity-only sort.

- [ ] **Step 5: Rerun all core search tests.**

Run:

```powershell
node --test --experimental-strip-types src/search/*.test.mjs
```

Expected: new regressions and existing search fusion, pipeline, normalization, presentation, and person-ranking tests pass.

### Task 3: Make the hero selector use the shared title model

**Files:**
- Modify: `apps/web/lib/search/featured-title.ts`
- Modify: `apps/web/lib/search/featured-title.test.mjs`
- Modify: `packages/core/src/search/title-ranking.ts` only if the shared interface needs a narrowly scoped text-evidence adapter

**Interfaces:**

- Preserve `selectFeaturedTitleResult(query, results)` and `withoutFeaturedTitleResult` signatures.
- Preserve `getFeaturedTitleCompletion` behavior.
- The selector must use the same title tier and audience helpers as the core ranker.

- [ ] **Step 1: Add failing hero regression tests.**

Add fixtures for:

```js
const lowAudienceDuna2018 = titleResult({
  id: 'title:movie:2018',
  name: 'Duna',
  year: 2018,
  media: { id: 2018, title: 'Duna', vote_count: 100, popularity: 2 },
})
const highAudienceDuna2021 = titleResult({
  id: 'title:movie:2021',
  name: 'Duna',
  year: 2021,
  media: { id: 2021, title: 'Duna', vote_count: 30_000, popularity: 500 },
})
const obscureObsession = titleResult({
  id: 'title:movie:1976',
  name: 'Obsession',
  year: 1976,
  media: { id: 1976, title: 'Obsession', vote_count: 80, popularity: 1 },
})
const recognizedObsession = titleResult({
  id: 'title:movie:2019',
  name: 'Obsession',
  year: 2019,
  media: { id: 2019, title: 'Obsession', vote_count: 12_000, popularity: 120 },
})
const lowAudienceEnglishDune = titleResult({
  id: 'title:movie:101',
  name: 'Dune',
  media: { id: 101, title: 'Dune', vote_count: 80, popularity: 2 },
})
const highAudienceLocalizedDuna = titleResult({
  id: 'title:movie:102',
  name: 'Duna',
  media: { id: 102, title: 'Duna', vote_count: 20_000, popularity: 300 },
})

test('featured title selects Duna 2021 for comparable strong matches', () => {
  const selected = selectFeaturedTitleResult('duna', [lowAudienceDuna2018, highAudienceDuna2021])
  assert.equal(selected?.year, 2021)
})

test('featured title selects the audience-recognized Obsession result', () => {
  const selected = selectFeaturedTitleResult('obsession', [obscureObsession, recognizedObsession])
  assert.equal(selected?.year, 2019)
})

test('localized strong match participates in audience reordering', () => {
  const selected = selectFeaturedTitleResult('duna', [lowAudienceEnglishDune, highAudienceLocalizedDuna])
  assert.equal(selected?.media.id, highAudienceLocalizedDuna.media.id)
})

test('featured title and compact list use one identity and do not duplicate the selected result', () => {
  const featured = selectFeaturedTitleResult('duna', [lowAudienceDuna2018, highAudienceDuna2021])
  assert.deepEqual(
    withoutFeaturedTitleResult([lowAudienceDuna2018, highAudienceDuna2021], featured).map((item) => item.media.id),
    [lowAudienceDuna2018.media.id]
  )
})
```

- [ ] **Step 2: Run the focused hero tests and verify RED.**

Run from `apps/web`:

```powershell
node --test --experimental-strip-types lib/search/featured-title.test.mjs
```

Expected: the new audience-relevance assertions fail against the current large lexical-tier constants or presentation-only fields.

- [ ] **Step 3: Replace the local score formula with shared signals.**

Derive evidence from the existing display title, media title/name, and localized presentation title. Map exact and valid prefix matches into the same strong band used by core. Feed `media.vote_count`, `media.popularity`, and `media.vote_average` into the shared audience helper. Keep completion validation unchanged.

- [ ] **Step 4: Rerun hero and autocomplete-adjacent tests.**

Run:

```powershell
node --test --experimental-strip-types lib/search/featured-title.test.mjs lib/search/gateway.test.mjs lib/search/presentation.test.mjs
```

Expected: the featured title follows the new audience-aware model, while completion and presentation tests remain green.

### Task 4: Verify title document metric consistency

**Files:**
- Inspect and only modify if a failing test proves a gap: `apps/web/lib/search/upstash/title-document.ts`
- Inspect and only modify if a failing test proves a gap: `apps/web/lib/search/upstash/title-indexer.ts`
- Inspect and only modify if a failing test proves a gap: `apps/web/app/api/v1/search/sync-title/route.ts`
- Test: `apps/web/lib/search/upstash/title-document.test.mjs`
- Test: `apps/web/lib/search/upstash/indexer.test.mjs`

- [ ] **Step 1: Add assertions that normalized title documents retain popularity, vote count, and vote average.**

Cover persisted/TMDb-shaped input, missing values, and lazy/indexer writes. Assert that missing values are omitted or neutralized consistently and no extra TMDb request is introduced.

- [ ] **Step 2: Run the focused document/indexer tests and verify the current behavior or failure.**

Run from `apps/web`:

```powershell
node --test --experimental-strip-types lib/search/upstash/title-document.test.mjs lib/search/upstash/indexer.test.mjs lib/search/sync-title-route.test.mjs
```

- [ ] **Step 3: Make the smallest synchronization fix only if required.**

Keep the existing shared title mapper and JSON key prefixes. Do not change the Redis schema or setup script unless the tests demonstrate a missing field in a write path.

### Task 5: Full verification and handoff

**Files:**
- No production files unless verification exposes a directly related issue.

- [ ] **Step 1: Run core search tests and typecheck.**

```powershell
node --test --experimental-strip-types src/search/*.test.mjs
```

from `packages/core`, followed by:

```powershell
& '.\node_modules\.bin\tsc.CMD' --noEmit
```

- [ ] **Step 2: Run web focused tests, typecheck, lint, and Biome.**

```powershell
node --test --experimental-strip-types lib/search/*.test.mjs lib/search/providers/*.test.mjs lib/search/upstash/*.test.mjs
& '.\node_modules\.bin\tsc.CMD' --noEmit
& '..\..\node_modules\.bin\biome.CMD' check lib/search packages/core/src/search
& '..\..\node_modules\.bin\biome.CMD' lint app components lib stores
```

- [ ] **Step 3: Run the production web build.**

```powershell
& 'C:\Users\caio\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' --filter @kino/web build
```

- [ ] **Step 4: Inspect the final diff and unrelated worktree state.**

```powershell
git diff --check
git status --short
git diff --stat -- packages/core/src/search apps/web/lib/search apps/web/components/global-search.tsx
```

Confirm no Redis schema/setup, UI layout, mobile, or unrelated dirty files were changed.

- [ ] **Step 5: Report exact verification evidence and operational impact.**

State the exact cause, changed files, tier model, audience formula, schema/backfill/recreation impact, regression tests, and any pre-existing unrelated full-suite failures. Do not claim the broader suite passes unless its command exits successfully.
