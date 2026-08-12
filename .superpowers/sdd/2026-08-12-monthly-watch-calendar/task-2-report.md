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
