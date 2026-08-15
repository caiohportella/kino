# Task 3 Report

## Files

- `packages/core/src/database.ts`
- `apps/web/lib/profile-query-service.ts`
- `apps/web/lib/profile-query-options.ts`
- `apps/web/lib/profile-query-service.test.mjs`
- `apps/web/lib/profile-query-options.test.mjs`
- `.superpowers/sdd/2026-08-15-lifetime-recap-story-refactor/task-3-report.md`

## Commit SHA

- `dc0c989c18c414332bdaa478d39159d43a44a89c`

## RED commands

1. Exact brief command:

   ```bash
   pnpm --filter @kino/web test -- --test-name-pattern="dedicated database method"
   ```

   Result: failed, but not cleanly on Task 3 because the dirty web test glob already contains unrelated failures.

2. Focused file-scoped RED used to verify the actual missing adapter behavior:

   ```bash
   node --test --experimental-strip-types "D:/Programming/Projects_ReactNative/kino/apps/web/lib/profile-query-service.test.mjs" --test-name-pattern="empty lifetime recap"
   ```

   Result: FAIL with:

   ```text
   service.getProfileLifetimeRecapByProfileId is not a function
   ```

## GREEN / verification commands

1. Focused service tests:

   ```bash
   node --test --experimental-strip-types "D:/Programming/Projects_ReactNative/kino/apps/web/lib/profile-query-service.test.mjs" --test-name-pattern="lifetime recap"
   ```

   Result: PASS

2. Query-options tests:

   ```bash
   node --test --experimental-strip-types "D:/Programming/Projects_ReactNative/kino/apps/web/lib/profile-query-options.test.mjs"
   ```

   Result: PASS

## Typecheck commands

1. Exact package typecheck:

   ```bash
   pnpm --filter @kino/core typecheck
   ```

   Result: PASS

2. Exact package typecheck:

   ```bash
   pnpm --filter @kino/web typecheck
   ```

   Result: PASS

## Additional command notes

- I also tried:

  ```bash
  pnpm exec tsc --noEmit -p packages/core/tsconfig.json
  pnpm exec tsc --noEmit -p apps/web/tsconfig.json
  ```

  Those are not the repo’s reliable verification path here; they hit a mismatched CLI/config combination in the sandbox:

  ```text
  error TS5070: Option '--resolveJsonModule' cannot be specified without 'node' module resolution strategy.
  packages/config/tsconfig/base.json(4,5): error TS5023: Unknown compiler option 'allowImportingTsExtensions'.
  packages/config/tsconfig/base.json(10,25): error TS6046: Argument for '--moduleResolution' option must be: 'node', 'classic', 'node16', 'nodenext'.
  ```

## Self-review

- Added `KinoDatabaseService.getProfileLifetimeRecapByProfileId(profileId)` immediately after the lightweight lifetime stats method.
- Kept `getProfileLifetimeStatsByProfileId` and its RPC/table fallback behavior unchanged.
- Used the monthly-equivalent select clauses for diary, movie ratings, and episode ratings.
- Ran the five lifetime recap requests in `Promise.all`.
- Left `episode_ratings` unfiltered so null ratings still contribute watch metadata.
- Threw on query errors and returned a safe empty `ProfileLifetimeRecap` from the catch path with the required log message.
- Added the optional lifetime recap method to the web adapter contracts and the empty legacy fallback.
- Added/updated focused tests around dedicated delegation and missing-method fallback.

## Concerns

- The exact brief command

  ```bash
  pnpm --filter @kino/web test -- --test-name-pattern="lifetime recap"
  ```

  still fails because of unrelated dirty-tree test issues outside Task 3. The failures I observed include:

  - `apps/web/lib/activity-feed-presentation.test.mjs` -> `ENOENT` for `apps/web/components/activity-feed/ActivityCard.tsx`
  - `apps/web/lib/localized-consumers.test.mjs` -> `ENOENT` for `apps/web/components/media-card.tsx` and `apps/web/components/profile-view.tsx`
  - `apps/web/lib/localized-title-batch-server.test.mjs` -> existing assertion mismatches around `/base.jpg` vs `/default.jpg` and `/base-backdrop.jpg` vs `/default-backdrop.jpg`
  - `apps/web/lib/localized-title-batch.test.mjs`, `apps/web/lib/title-prefetch.test.mjs`, `apps/web/lib/tmdb-context.test.mjs`, `apps/web/lib/watchlist-cover-version.test.mjs` -> `ERR_MODULE_NOT_FOUND` for `@kino/packages`

  These are pre-existing broader-suite failures; the focused Task 3 tests and both package typechecks passed.
