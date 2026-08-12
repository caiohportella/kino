# Task 4 report — comparison tone helper and previous-month card integration

Implemented only the Task 4 comparison surface:

- Added `ComparisonTone` and `getComparisonTone(delta)` in `apps/web/lib/monthly-comparison.ts`.
- Added `PreviousMonthComparisonRow.delta` while preserving the localized `value` string.
- Added shared row construction for the four existing comparison rows: time watched, movies watched, episodes watched, ratings made.
- Updated `apps/web/components/profile/previous-month-card.tsx` to render semantic lucide icons:
  - positive → `ArrowUp` with `text-kino-accent`
  - negative → `ArrowDown` with muted/down styling
  - neutral → `Minus` with `text-kino-muted`
  - all icons are decorative with `aria-hidden="true"`
- Wired `apps/web/components/profile/profile-monthly-recap-page.tsx` to the shared row builder without changing server-provided comparison values or the existing row set.
- Added `apps/web/lib/monthly-comparison.test.mjs` for tone selection and all-four-row coverage, including duration formatting.

Verification:

- `node --test --experimental-strip-types apps/web/lib/monthly-comparison.test.mjs` ✅
- `node --test --experimental-strip-types packages/core/src/profile-stats.test.mjs --test-name-pattern "monthly recap|comparison"` ✅
- `pnpm --filter @kino/web typecheck` ⚠️ fails in pre-existing `packages/core/src/use-cases.ts:89:42` (`string | undefined` not assignable to `string`)

Notes:

- The repo has a large pre-existing dirty worktree; I kept changes scoped to Task 4 files only.
- I preserved the existing watch-time formatting behavior and all four comparison rows.
