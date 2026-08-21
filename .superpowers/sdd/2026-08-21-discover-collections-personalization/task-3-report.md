# Task 3 Report: Normalize personalized rail selection on the server

## Summary

Implemented the smallest coherent normalized rail-selection slice for Discover personalization without broadening into UI work. The server now exposes a normalized personalized rail contract, retains localized seed display data for the strongest viable diary seed, and keeps the current Discover page on the legacy client props by deriving `forYou` from the normalized rail list.

## Changed files

- `apps/web/lib/discover/personalization.ts`
- `apps/web/lib/discover/server-personalization.ts`
- `apps/web/app/discover/page.tsx`
- `apps/web/lib/tests/discover/discover-personalized-rails.test.mjs`

## Commit

- `afc198d` — `feat(web): normalize discover personalized rails`

## What changed

- Added `PersonalizedDiscoverRail` plus `selectPersonalizedDiscoverRails(...)` to keep rail selection heuristics in pure server-side logic.
- Added minimum-strength filtering for:
  - `because-you-liked` rails, which now require a viable seed and a strong recommendation set.
  - affinity rails, which now select only the strongest existing actor/director/studio row with enough items.
- Extended server personalization to:
  - preserve the strongest viable diary seed,
  - fetch canonical TMDb seed details in the active language,
  - exclude watched and rated titles from recommendation output,
  - compose recommendation and affinity inputs into normalized rails with bounded failure handling.
- Updated the Discover page to:
  - fetch normalized personalized rails only for authenticated users,
  - degrade to `[]` on personalization errors with the existing logging style,
  - keep current UI behavior by mapping the normalized `because-you-liked` rail back to the existing `forYou` prop.

## Tests run

### Focused Discover tests

Run:

```powershell
pnpm --filter web exec node --test lib/tests/discover/discover-personalized-rails.test.mjs lib/tests/discover/discover-personalization.test.mjs
```

Result:

- 13 tests passed
- 0 failed

Key output:

```text
ok 1 - recommendation seeds prioritize highly rated titles
ok 10 - recommendation result count is bounded
ok 11 - selects a strong because-you-liked rail before affinity
ok 12 - omits empty and weak rails and caps output at two
ok 13 - preserves the seed/source data needed for localized headings
```

### Web typecheck

Run:

```powershell
pnpm exec tsc --noEmit
```

Working directory:

```text
apps/web
```

Result:

- Exit code `0`
- No typecheck output

## Self-review

- Kept the work scoped to Task 3 server normalization and page wiring only.
- Did not add UI rendering for the new rail union.
- Verified the existing recommendation seed/ranking tests still pass after the new server composition.
- Preserved anonymous-user behavior by returning no personalized rails from the page path when no user is present.

## Concerns

- `app/discover/page.tsx` still fetches `getDiscoverAffinityData(...)` separately for existing Discover sections and release-signal logic, while `getPersonalizedDiscoverRails(...)` also composes affinity internally. That duplication is acceptable for this minimal Task 3 slice, but it is the main follow-up area once the dedicated personalized UI lands and the page can consume normalized rails directly end-to-end.

## Fix round 1

### Summary

Adjusted normalized personalized rail composition to fail closed when either upstream personalization fetch rejects. The server no longer exposes partial rails from whichever branch survived; it now logs with the existing discover-personalization style and returns `[]`.

### Changed files

- `apps/web/lib/discover/personalization.ts`
- `apps/web/lib/discover/server-personalization.ts`
- `apps/web/lib/tests/discover/discover-personalized-rails.test.mjs`

### What changed

- Added a pure `buildPersonalizedDiscoverRails(...)` helper in `personalization.ts` that:
  - returns `[]` when recommendation fetches reject,
  - returns `[]` when affinity fetches reject,
  - logs the corresponding failure through the provided logger,
  - preserves the existing at-most-two selection logic when both inputs succeed.
- Updated `getPersonalizedDiscoverRails(...)` in `server-personalization.ts` to delegate to the pure fail-closed helper instead of assembling partial inputs after `Promise.allSettled(...)`.
- Added a focused regression test covering both partial-failure paths.

### Tests run

Run:

```powershell
pnpm --filter web exec node --test lib/tests/discover/discover-personalized-rails.test.mjs lib/tests/discover/discover-personalization.test.mjs
```

Result:

- 14 tests passed
- 0 failed

Key output:

```text
ok 13 - preserves the seed/source data needed for localized headings
ok 14 - fails closed when either personalization fetch rejects
```

Run:

```powershell
pnpm exec tsc --noEmit
```

Working directory:

```text
apps/web
```

Result:

- Exit code `0`
- No typecheck output

### Concerns

- The page still fetches affinity separately for existing Discover sections, so this round only closes the normalized rail contract itself. The remaining duplication is unchanged from the prior Task 3 slice.

## Fix round 2

### Summary

Adjusted the fail-closed helper to log both rejected personalization branches before returning `[]` when recommendation and affinity fetches both fail.

### Changed files

- `apps/web/lib/discover/personalization.ts`
- `apps/web/lib/tests/discover/discover-personalized-rails.test.mjs`

### What changed

- Updated `buildPersonalizedDiscoverRails(...)` so it:
  - records whether either branch failed,
  - logs the recommendation rejection when present,
  - logs the affinity rejection when present,
  - returns `[]` only after both logging paths have run.
- Added a dual-failure regression test that verifies:
  - the helper still fails closed to `[]`,
  - both logging messages are emitted in the dual-reject case.

### Tests run

Run:

```powershell
pnpm --filter web exec node --test lib/tests/discover/discover-personalized-rails.test.mjs lib/tests/discover/discover-personalization.test.mjs
```

Result:

- 15 tests passed
- 0 failed

Key output:

```text
ok 14 - fails closed when either personalization fetch rejects
ok 15 - logs both failures before failing closed when both personalization fetches reject
```

Run:

```powershell
pnpm exec tsc --noEmit
```

Working directory:

```text
apps/web
```

Result:

- Exit code `0`
- No typecheck output

### Concerns

- No new scope concerns in this round. The remaining Discover-page affinity duplication is unchanged and still outside this fix-only slice.
