# Task 4 report - comparison tone helper and previous-month card integration

Implemented only the Task 4 comparison surface:

- Added `ComparisonTone` and `getComparisonTone(delta)` in `apps/web/lib/monthly-comparison.ts`.
- Kept the tone helper focused on sign classification and moved watch-time string formatting back to `apps/web/components/profile/profile-monthly-recap-page.tsx`.
- Kept `PreviousMonthComparisonRow.delta` while preserving the localized `value` string.
- Kept shared row construction for the four existing comparison rows: time watched, movies watched, episodes watched, ratings made.
- Updated `apps/web/components/profile/previous-month-card.tsx` to render semantic lucide icons with decorative `aria-hidden="true"` icons.
- Added `apps/web/lib/monthly-comparison.test.mjs` for tone selection and all-four-row coverage, including the page-owned duration formatting callback.

Verification:

- `node --test --experimental-strip-types apps/web/lib/monthly-comparison.test.mjs` passed
- `node --test --experimental-strip-types packages/core/src/profile-stats.test.mjs --test-name-pattern "monthly recap|comparison"` passed
- `pnpm --filter @kino/web typecheck` failed in pre-existing `packages/core/src/use-cases.ts:89:42` (`string | undefined` not assignable to `string`)

Notes:

- I kept the work scoped to the Task 4 files and did not touch unrelated files.
- The repo still has a large pre-existing dirty worktree.
