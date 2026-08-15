# Final Review Fix Report

## Scope

Applied the requested whole-branch review fixes in the current checkout while leaving unrelated dirty-tree content unstaged.

## Findings addressed

1. Added the two required recap support modules to the commit: `apps/web/lib/profile-recap.ts` and `apps/web/lib/profile-stats.ts`.
2. Exported `./profile-stats.ts` from `packages/core/src/index.ts`. The pre-existing dirty `locale-config` export remains unstaged.
3. Replaced the three single-request lifetime recap activity reads with a 500-row paginated helper. Each query is ordered by `watched_at`, `title_id`, and `id`; movie ratings retain the non-null filter; episode ratings intentionally remain unfiltered; `getWatchedSeries(profileId).catch(() => [])` and the outer safe-empty recap catch are unchanged.
4. Replaced JavaScript-overflow anniversary calculations with clamped calendar anniversaries, covering leap-day and month-end membership dates.
5. Removed monthly recap `profileId`/`displayName` query-parameter bypasses. The endpoint now resolves the profile and branded name only from the route username server-side.
6. Added locale regression assertions that verify `{{name}}`, `{{year}}`, and each Kino Time `{{count}}` token in every supported locale.

## Regression coverage

- `packages/core/src/database-recap-pagination.test.mjs` proves all three lifetime activity sources page beyond the Supabase default and apply deterministic ordering.
- Lifetime story tests cover leap-day and month-end clamped anniversaries.
- Monthly recap source coverage rejects caller-supplied identity parameters.
- Lifetime locale coverage verifies interpolation tokens.

## Verification

- Focused direct Node tests: 17 passing (pagination, lifetime story, route contract, and locale coverage).
- `pnpm --filter @kino/core typecheck`: passed.
- `pnpm --filter @kino/web typecheck`: passed.
- Focused Biome checks passed for modified web files; focused core lint passed for the database implementation and pagination regression. `packages/core/src/database.ts` has repository-wide pre-existing semicolon formatting that conflicts with the current Biome formatter, so it was linted without reformatting unrelated baseline content.
- `pnpm build:web`: passed, including the OG bundle check.
- The package-wide web test command still reports unrelated dirty-baseline missing-component and existing localization failures; it also does not isolate tests by name before loading all files.
- `git diff --check` reports pre-existing trailing whitespace in `apps/web/lib/localized-title-batch-server.ts`, outside this fix scope.

## Commit contents

The commit should include only the recap baseline modules, core profile-stats export, requested fixes, focused regression tests, and this report. No unrelated dirty files are staged.
