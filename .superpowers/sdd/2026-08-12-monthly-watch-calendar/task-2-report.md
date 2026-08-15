# Task 2 report — Monthly watch calendar model

Implemented the pure monthly watch calendar model in `apps/web/lib/monthly-watch-calendar.ts` and covered it with focused Node tests in `apps/web/lib/monthly-watch-calendar.test.mjs`.

What the model now does:

- Builds a deterministic seven-column month grid with Monday-first default ordering.
- Uses UTC-safe month and date-only key handling.
- Keeps outside-month cells inactive with `activity: null`.
- Derives `activeDays`, `longestStreak`, `mostActiveDay`, `biggestBingeDay`, and `maxMinutes`.
- Assigns monthly-relative intensity levels from `0..4`, with zero/inactive days at `0` and the highest positive-minute day at `4`.

Verification:

- `node --test --experimental-strip-types apps/web/lib/monthly-watch-calendar.test.mjs`

Result:

- Passed.

Notes:

- The workspace already contained many unrelated dirty changes, so I kept the implementation scoped to the requested files plus this report file only.
- No unrelated files were modified.

## Round 1 review fixes

Updated the model so intensity is now magnitude-based for the month instead of being assigned by the ordinal order of distinct positive minute values. The new scale uses the month's positive-minute min/max range, keeps zero and inactive cells at level 0, and keeps the highest positive-minute day at level 4.

The test suite now includes a skewed `[1, 2, 1000]` case that proves the small values remain in the low band instead of being promoted by rank.

The biggest-binge test was also expanded so the top episode-count days tie on episodes and minutes, and the earliest date wins the final tie-break.

Rerun command:

```powershell
node --test --experimental-strip-types apps/web/lib/monthly-watch-calendar.test.mjs
```

Rerun output summary:

- 8 tests passed.
- 0 tests failed.
- 0 tests skipped.
