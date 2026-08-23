# Task 1 Report

## Changed Files

- `apps/web/lib/discover/collections.ts`
- `apps/web/lib/tests/discover/discover-collections.test.mjs`

## Validation Summary

- Inspected the inherited Task 1 implementation against the brief, plan, and design spec.
- Confirmed the registry/query module already existed in `HEAD`; there were no leftover uncommitted Task 1 source files to recover.
- Found and fixed a query-key correctness bug: `mergeDiscoverCriteria` used raw `mediaType` and `minRating` inputs in `queryKey` even when the effective TMDb requests were identical after collection criteria normalization.
- Reworked the query key to derive from the effective per-type request set, preserving collection identity while collapsing redundant cache states.
- Added regression coverage for redundant user ratings on `hidden-gems` and incompatible TV state on `quick-watch`.

## Commit

- `3a1d7e3` — `fix(web): stabilize discover collection query keys`

## Tests Run

- `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`

## Test Output

### Red phase

- Added two regression tests:
  - `query keys use effective collection rating criteria`
  - `quick watch query keys collapse incompatible tv state`
- Initial run failed as expected:
  - `query keys use effective collection rating criteria` failed because the old key encoded raw `minRating` (`0` vs `6`) despite identical request params.
  - `quick watch query keys collapse incompatible tv state` failed because the old key encoded raw `mediaType` (`all` vs `movie`) despite identical movie-only request output.

### Green phase

- Final run passed:
  - `7` tests run
  - `7` passed
  - `0` failed

## Concerns

- No blocking Task 1 concerns remain after the query-key fix.
- `new-this-month` still depends on the current date window by design, so its effective request signature will naturally roll forward over time.

## Fix Round 1

### Changed Files

- `apps/web/lib/discover/collections.ts`
- `apps/web/lib/tests/discover/discover-collections.test.mjs`
- `.superpowers/sdd/2026-08-21-discover-collections-personalization/task-1-report.md`

### Validation Summary

- Confirmed the inherited partial fix already removed load-time `new Date()` usage from the registry and added explicit date-window injection points.
- Reproduced the remaining `something-weird` bug with a new regression: if a user selected an overlapping genre like Horror (`27`), the helper dropped the rest of the collection mix and collapsed to a plain `with_genres=27` shortcut.
- Fixed `buildGenreFilter` so overlapping user genres become required while the remaining collection-only genre signals stay in the query, preserving the bounded mixed-genre behavior.
- Strengthened `new-this-month` coverage to prove the pure registry emits no implicit current-date bounds without an explicit window and that repeated calls with the same supplied window produce identical requests/query keys.
- Kept the prior query-key stabilization intact.

### Commit

- Recorded in the git commit created for this fix round.

### Tests Run

- `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`
- `pnpm --filter web exec tsc --noEmit`

### Test Output

#### Red phase

- `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`
- Initial failure reproduced as expected:
  - `something weird keeps its bounded genre mix when filters overlap`
  - Expected `with_genres` to remain `27,14|878|9648`
  - Actual `with_genres` was `27`

#### Green phase

- `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`
  - `9` tests run
  - `9` passed
  - `0` failed
- `pnpm --filter web exec tsc --noEmit`
  - Exit code `0`

### Concerns

- The earlier report's note about `new-this-month` depending on the current date window is now outdated; this module stays pure until an explicit date window is supplied by the caller.
- No blocking concerns remain for the two requested findings.

---

## Task 1 Fix Round 1

### Changed Files

- `apps/web/lib/discover/collections.ts`
- `apps/web/lib/tests/discover/discover-collections.test.mjs`

### Validation Summary

- Replaced `something-weird`'s plain stored genre list with collection-specific `genreAnyOf` handling so the collection serializes as its own genre-mix query instead of a normal user genre shortcut.
- Removed `new-this-month` load-time `new Date()` usage from the pure registry and moved the date behavior to an explicit injected `dateWindow` option on query building.
- Preserved the existing query-key stabilization from commit `3a1d7e3`; effective params still drive the key, and injected date windows now participate through the built request params.
- Added regression coverage for the collection-only `something-weird` genre mix and deterministic `new-this-month` date-window injection.

### Commit

- `1c03cde` - `fix(web): refine discover collection criteria`

### Tests Run

- `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`
- `pnpm exec tsc --noEmit`

### Test Output

#### Red phase

- Initial regression run failed as expected:
  - `something weird keeps a collection-only genre mix` failed because the implementation serialized `with_genres` as `14,27,878,9648` instead of a collection-specific mixed signal.
  - `new this month uses an explicit date window deterministically` failed because the implementation ignored the explicit window and still emitted load-time dates (`2026-08-01` instead of `2024-02-10`).

#### Green phase

- Final targeted test run passed:
  - `9` tests run
  - `9` passed
  - `0` failed
- Web package typecheck passed with `pnpm exec tsc --noEmit`.

### Concerns

- The pure module no longer injects a default current-month window for `new-this-month`; callers that need bounded date behavior must pass `dateWindow` explicitly or augment the built params upstream.

---

## Task 1 Fix Round 2

### Changed Files

- `apps/web/lib/discover/collections.ts`
- `apps/web/lib/tests/discover/discover-collections.test.mjs`
- `.superpowers/sdd/2026-08-21-discover-collections-personalization/task-1-report.md`

### Validation Summary

- Reproduced the remaining `new-this-month` issue with a regression that exercised both the direct helper and the merged discover-query path without an explicit `dateWindow`.
- Confirmed the root cause was shared query construction: the collection omitted bounds when no window was supplied, but still returned a valid request payload, which let `mergeDiscoverCriteria` emit an unbounded live request.
- Changed the criteria builder to fail closed for date-window collections when `dateWindow` is missing, and skipped those null request payloads when assembling discover requests.
- Preserved the explicit-window behavior and request-driven query-key normalization; the same supplied window still produces identical params and query keys across repeated calls.

### Tests Run

- `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`
- `pnpm --filter web exec tsc --noEmit`

### Test Output

#### Red phase

- `new this month requires an explicit date window and stays deterministic with one` failed as expected before the fix.
- The failure showed `buildDiscoverCollectionParams(parseDiscoverCollection('new-this-month'), 'movie')` still returned a request payload instead of failing closed without `dateWindow`.

#### Green phase

- `pnpm --filter web exec node --test lib/tests/discover/discover-collections.test.mjs`
  - `9` tests run
  - `9` passed
  - `0` failed
- `pnpm --filter web exec tsc --noEmit`
  - Exit code `0`

### Concerns

- No blocking concerns for this scoped finding.
