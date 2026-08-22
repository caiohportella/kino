# Task 7 Verification Report

Date: 2026-08-22
Branch: `codex/web-platform-updates`
Status: Partial pass after scoped verification fixes. Discover collections/personalization verification issues were corrected, but the exact required `pnpm --filter web test -- lib/tests/discover` command still exits non-zero because of remaining unrelated web test failures outside Task 7 scope.

## Verification fixes applied

1. Restored discover layout verification after the `lib/tests` move by fixing the file paths in `apps/web/lib/tests/discover/layout.test.mjs`.
2. Realigned `apps/web/lib/tests/discover/discover-server-release-relevance.test.mjs` with the current server helper contract (`relatedReleases` / `relatedSeries`) and the shared release-ranking semantics now exercised by production code.
3. Restored comfortable discover row density in normal `/discover` flow by adding `density="comfortable"` to the editorial `MediaSection` rows in `apps/web/components/discover/discover-client.tsx`.

## Exact required checks

- `pnpm --filter web test -- lib/tests/discover`
  - Result: FAIL
  - Fresh summary after fixes: 623 passing, 10 failing
  - Remaining failing tests:
    - `standalone shell uses a bootstrap bridge and conditional chrome rendering`
    - `keeps collection search typing local before committing the URL query`
    - `profile dashboard separates identity hero from profile statistics`
    - `profile hero keeps identity content separate from the stat row`
    - `connects the movies collection page to the client profile services`
    - `ProfileView is a thin composition root`
    - `profile hero uses fluid desktop sizing`
    - `watchlist posters render watched indicators without intercepting poster links`
    - `movie ratings panel gives the interactive control room before three-column desktop layout`
    - aggregate `lib\\tests\\discover` entry reported by the test runner
- `pnpm --filter web lint`
  - Result: PASS with 2 warnings, 0 errors
  - Warnings:
    - `components/media/media-row.tsx`: extra `useLayoutEffect` dependency (`hasOverflow`)
    - `lib/discover/series-updates.ts`: `Array<T>` vs `T[]` style warning
- `pnpm --filter web exec tsc --noEmit`
  - Result: PASS
- `pnpm --filter web build`
  - Result: PASS
  - Notes:
    - Next.js build completed successfully
    - OG edge bundle check passed
    - Build emitted an existing warning that edge runtime disables static generation for affected pages

## Focused discover regression evidence

- `node --test --experimental-strip-types lib/tests/discover/layout.test.mjs`
  - PASS after fixes
- `node --test --experimental-strip-types lib/tests/discover/discover-server-release-relevance.test.mjs`
  - PASS after fixes
- `node --test --experimental-strip-types lib/tests/discover/discover-url-state.test.mjs`
  - PASS
- `node --test --experimental-strip-types lib/tests/discover/discover-collections.test.mjs`
  - PASS

## URL/state and final-code inspection

- Invalid collection ids fall back to normal Discover without throwing via `parseDiscoverCollection()` + `readDiscoverUrlState()` in `apps/web/lib/discover/discover-url-state.ts`.
- Clearing a collection preserves unrelated filters/search params via `writeDiscoverCollectionUrl()` in the same file.
- Selecting a collection preserves applicable `type` / `genres` / `rating` and clears stale `page` via `writeDiscoverCollectionUrl()` and `writeDiscoverFilterUrl()` in the same file.
- Quick Watch never emits a TV runtime query because `quick-watch` only defines movie criteria and `buildDiscoverCollectionParams()` returns `null` for unsupported media types in `apps/web/lib/discover/collections.ts`.
- New This Month cannot build an unbounded request because `buildParamsForCriteria()` exits early when `dateWindowField` is present without an explicit `dateWindow` in `apps/web/lib/discover/collections.ts`; `/discover` only supplies that window when `activeCollection?.id === "new-this-month"` in `apps/web/components/discover/discover-client.tsx`.
- Anonymous / cold-start users render no “For You” heading because `apps/web/components/discover/personalized-discover-section.tsx` returns `null` when `visibleRails.length === 0`.
- “For You” appears before “Explore Collections” in normal flow because `apps/web/components/discover/discover-client.tsx` renders `PersonalizedDiscoverSection` before `ExploreCollections`.
- Collection identity separates query keys because `mergeDiscoverCriteria()` includes `collectionId` in its query key and `/discover` uses `["discover-filtered", discoverCriteria.queryKey]`.
- No stale runtime import/reference to a removed discover shortcut component was found by source search.
- Collection cards still use `MediaRow` with `overflowAware` and bounded widths in `apps/web/components/discover/explore-collections.tsx`, so I did not find a code-level horizontal overflow/accessibility regression from this feature.

## Concerns

- The exact required `pnpm --filter web test -- lib/tests/discover` command is still red because the package test script runs the broader web test suite, and 9 remaining named failures are outside Task 7 scope.
- One of those remaining failures, `keeps collection search typing local before committing the URL query`, is collection-related but lives in profile collection filters, not discover collections. I did not change it because the brief limited fixes to regressions caused by this feature.
- I did not run a live browser/manual UI session for `/discover`; the URL/state verification above is based on fresh test evidence plus direct final-code inspection.
