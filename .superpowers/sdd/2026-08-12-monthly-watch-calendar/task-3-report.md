# Task 3 report — Monthly watch calendar

Completed the final Task 3 pass for the monthly recap calendar.

What changed:

- Fixed the strict TypeScript issue in `apps/web/lib/monthly-watch-calendar.ts` by guarding the indexed active-date lookups before parsing them.
- Kept the existing monthly calendar draft in `apps/web/components/profile/monthly-watch-calendar.tsx` and the recap page wiring in `apps/web/components/profile/profile-monthly-recap-page.tsx`.
- Kept the monthly activity heatmap test update in `apps/web/lib/profile-activity-heatmap.test.mjs` aligned with the dedicated monthly calendar component.

Verification:

- `node --test --experimental-strip-types apps/web/lib/profile-activity-heatmap.test.mjs`
- `node --test --experimental-strip-types apps/web/lib/profile-stats-localization.test.mjs`
- `pnpm --filter @kino/web typecheck`

Result:

- Both Node test files passed.
- `pnpm --filter @kino/web typecheck` passed after rerunning with local escalation because Corepack could not open the pnpm cache path in the sandboxed run.

Notes:

- I left the unrelated dirty worktree entries untouched.
- The locale coverage required by the localization test was already present in the current worktree state, so no additional locale edits were needed in this final pass.
