# Task 2 Implementation Report

Status: DONE

Commit hashes:

- `fae6b37ececc08d18f56b62ab204d1a82e7c25cf` — focused Task 2 mixed-path follow-up before the intrinsic-score replacement
- The follow-up commit hash is returned in the task handoff. Writing that hash into this file would change the commit hash again.

Files changed:

- `packages/core/src/search/rank.ts`
- `packages/core/src/search/rank.test.mjs`
- `.superpowers/sdd/2026-08-13-search-audience-ranking/task-2-report.md`

Scope summary:

- Added core regression coverage for audience-aware title ordering, relevance protection, vote-count precedence within comparable strong title matches, and user stable-identity protection.
- Integrated the shared title-ranking helpers into core ranking as a movie/series title-specific comparator.
- Kept people, users, and relationship-driven media candidates on the existing weighted ranking path.
- Preserved `SearchScoreComponents` and existing response shapes.

Review follow-up:

- Added public-score consistency assertions for the Duna and Obsession title rankings.
- Eligible movie/series results now expose a bounded title-ranking score derived from the same tier/audience/text signals used for ordering.
- Retained the legacy weighted score as the internal fallback sort key and for non-title candidates, preserving the non-title path and cross-path fallback behavior.

Mixed title/relationship follow-up:

- Added a fused Dexter regression where the exact title and relationship movie are ordered by their intrinsic public scores, the relationship metadata is preserved, and scores are non-increasing.
- Removed context-dependent post-sort score mutation. Each rank record carries its intrinsic public score: title candidates use the bounded shared title-ranking score, while relationship/non-title candidates use the legacy weighted score.
- Title-title comparisons use the shared title comparator, then intrinsic score as the consistent fallback. Mixed movie/series title-versus-relationship comparisons use intrinsic public score, then legacy weighted score only as a deterministic tie-break. Non-title and relationship-versus-relationship comparisons retain legacy weighted ordering.

RED verification:

- Command: `node --test --experimental-strip-types src/search/rank.test.mjs src/search/title-ranking.test.mjs`
- Result: failed as expected on the new audience-ranking regressions before the `rank.ts` change:
  - `audience-recognized Duna wins within the strong title band`
  - `audience-recognized Obsession wins over an obscure same-tier exact title`
  - `vote count beats a high rating when text evidence is comparable`

Review follow-up RED verification:

- Command: `node --test --experimental-strip-types src/search/rank.test.mjs src/search/title-ranking.test.mjs`
- Result: failed only on the new Duna and Obsession public-score monotonicity assertions (17 passed, 2 failed) before the score-consistency change.

Mixed-path RED verification:

- Command: `node --test --experimental-strip-types src/search/rank.test.mjs src/search/title-ranking.test.mjs`
- Result: failed only on the mixed Dexter public-score monotonicity assertion (19 passed, 1 failed) while preserving the relationship-first order.

Intrinsic-score RED verification:

- Command: `node --test --experimental-strip-types src/search/rank.test.mjs src/search/title-ranking.test.mjs`
- Result: failed only on the Dexter intrinsic-order assertion (19 passed, 1 failed) against the previous mixed-score implementation; it returned the relationship movie first instead of ordering by its public score.

GREEN verification:

- Command: `node --test --experimental-strip-types src/search/rank.test.mjs src/search/title-ranking.test.mjs`
- Result: passed with 20 tests, 0 failures after the mixed-path fix.

Full core search verification:

- Command: `node --test --experimental-strip-types src/search/*.test.mjs`
- Result: passed with 65 tests, 0 failures.

Typecheck:

- Attempted command: `pnpm typecheck`
- Result: failed due sandbox/Corepack access (`EPERM` opening `C:\Users\caio\AppData\Local\node\corepack\v1\pnpm`).
- Command used for repository-local verification: `D:\Programming\Projects_ReactNative\kino\packages\core\node_modules\.bin\tsc.CMD --noEmit`
- Result: passed with exit code 0.

Notes:

- No pipeline-level assertion was needed; the ranking behavior was fully covered at `rankSearchCandidates`.
- Title-specific ordering is limited to movie/series candidates without relationship metadata so relationship expansion behavior stays on the existing path.

Concerns:

- Eligible movie/series V1 numeric scores are intrinsic: title candidates use the bounded title-ranking score and relationship candidates use the legacy weighted score. No score is changed after sorting.
- Mixed title/relationship media ordering intentionally follows those intrinsic public scores; relationship metadata and relationship-vs-relationship legacy ordering remain preserved.
- The legacy weighted score remains in the internal fallback sort key and `SearchScoreComponents` for non-title paths and deterministic ties.
- V2 continues to serialize the existing normalized score components, so its response shape and non-title behavior remain unchanged.
