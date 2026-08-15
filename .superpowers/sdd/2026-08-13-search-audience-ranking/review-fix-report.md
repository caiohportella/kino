# Final Review Fix Report

Status: DONE.

Commit:

- Exact commit hash is returned in the final handoff for the commit containing this report.

Files intentionally included:

- `packages/core/src/search/rank.ts`
- `packages/core/src/search/rank.test.mjs`
- `packages/core/src/search/normalize.ts`
- `packages/core/src/search/normalize.test.mjs`
- `packages/core/src/search/types.ts`
- `apps/web/app/api/v1/search/route.ts`
- `apps/web/app/api/v1/search/sync-title/route.ts`
- `apps/web/components/global-search.tsx`
- `apps/web/components/search/featured-search-result.tsx`
- `apps/web/lib/search/gateway.ts`
- `apps/web/lib/search/gateway.test.mjs`
- `apps/web/lib/search/observability.ts`
- `apps/web/lib/search/presentation.ts`
- `apps/web/lib/search/providers/users.ts`
- `apps/web/lib/search/request.ts`
- `apps/web/lib/search/request.test.mjs`
- `apps/web/lib/search/server-env.ts`
- `apps/web/lib/search/server-env.test.mjs`
- `apps/web/lib/search/sync-title-route.test.mjs`
- `apps/web/lib/search/upstash/**`
- `.superpowers/sdd/2026-08-13-search-audience-ranking/review-fix-report.md`

Fix summary:

- Restored the Godfather relationship-expanded ordering so a high-confidence relationship result beats incidental title text.
- Kept Duna/Obsession title behavior by preserving audience-aware ordering among comparable strong title candidates.
- Replaced the mixed title/relationship comparison with intrinsic calibrated media scores. Public `score` is assigned once from the same intrinsic contract used by the comparator; no post-sort score mutation is used.
- Updated lazy title indexing to accept real `SearchEntityV2` rating fields: `tmdbVoteAverage`, with `kinoAverageRating` and legacy `voteAverage` as fallback.
- Updated Upstash title hit mapping to expose stored `voteAverage` as `entity.tmdbVoteAverage`.
- Included the previously untracked Upstash search implementation, global search component, featured search component, sync-title route/test, and directly required search-only user fallback file so the search implementation boundary is self-contained.

TDD RED evidence:

- `node --test --experimental-strip-types src\search\rank.test.mjs src\search\title-ranking.test.mjs` from `packages/core` failed before the production ranking fix on the restored Godfather ordering: actual `[90, 238]`, expected `[238, 90]`.
- `node --test --experimental-strip-types lib\search\upstash\indexer.test.mjs lib\search\upstash\ranking.test.mjs` from `apps/web` failed before the production Upstash fix because `tmdbVoteAverage` was dropped in lazy indexing and Redis hit mapping.

Bounded verification:

- `node --test --experimental-strip-types src\search\rank.test.mjs src\search\title-ranking.test.mjs` from `packages/core`: 20 passed, 0 failed.
- `node --test --experimental-strip-types lib\search\featured-title.test.mjs lib\search\gateway.test.mjs lib\search\presentation.test.mjs lib\search\upstash\indexer.test.mjs lib\search\upstash\ranking.test.mjs lib\search\sync-title-route.test.mjs` from `apps/web`: 51 passed, 0 failed.
- `.\node_modules\.bin\tsc.CMD --noEmit` from `packages/core`: exit 0.
- `.\node_modules\.bin\tsc.CMD --noEmit` from `apps/web`: exit 0.
- Earlier scoped verification after the fix also passed:
  - `node --test --experimental-strip-types src\search\*.test.mjs` from `packages/core`: 65 passed, 0 failed.
  - `node --test --experimental-strip-types lib\search\featured-title.test.mjs lib\search\gateway.test.mjs lib\search\presentation.test.mjs lib\search\upstash\*.test.mjs lib\search\sync-title-route.test.mjs` from `apps/web`: 72 passed, 0 failed.
  - `.\node_modules\.bin\biome.CMD check packages\core\src\search apps\web\lib\search apps\web\components\global-search.tsx apps\web\components\search\featured-search-result.tsx` from repo root: exit 0.
  - `pnpm --filter @kino/web build`: exit 0.

Remaining issue:

- `node --test --experimental-strip-types lib\search\providers\*.test.mjs` from `apps/web` still has the pre-existing unrelated TMDb presentation assertion: `apps/web/lib/search/providers/tmdb.ts` currently returns `startDate: '1972-03-14'` while the test expectation omits it. That dirty TMDb provider change was not staged for this focused commit.
