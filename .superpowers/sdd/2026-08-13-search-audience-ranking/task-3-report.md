# Task 3 Implementation Report

Status: DONE

Commit hash:

- The focused Task 3 commit hash is returned in the handoff. Writing that hash into this file before committing would change the hash again.

Files changed:

- `apps/web/lib/search/featured-title.ts`
- `apps/web/lib/search/featured-title.test.mjs`
- `.superpowers/sdd/2026-08-13-search-audience-ranking/task-3-report.md`

Scope summary:

- Added web hero-selector regressions for Duna, Obsession, localized strong-match audience reordering, and no-duplicate compact-list behavior.
- Replaced the local featured-title million-point score formula with shared `@kino/core/search` title ranking signals and comparator.
- Kept featured-title identity, completion/caret behavior, case/diacritic normalization, token matching, lexical-match fallback, and UI-facing selector signatures unchanged.
- Did not modify `packages/core/src/search/title-ranking.ts`; no shared adapter change was required.

RED verification:

- Command: `node --test --experimental-strip-types lib/search/featured-title.test.mjs`
- Result: failed as expected before the production change after tightening the new regressions to exact-vs-prefix strong cases:
  - `featured title selects Duna 2021 for comparable strong matches`
  - `featured title selects the audience-recognized Obsession result`
  - `localized strong match participates in audience reordering`
  - `featured title and compact list use one identity and do not duplicate the selected result`

GREEN verification:

- Command: `node --test --experimental-strip-types lib/search/featured-title.test.mjs`
- Result: passed with 13 tests, 0 failures.

Focused adjacent verification:

- Command: `node --test --experimental-strip-types lib/search/featured-title.test.mjs lib/search/gateway.test.mjs lib/search/presentation.test.mjs`
- Result: passed with 40 tests, 0 failures.

Typecheck:

- Command: `.\node_modules\.bin\tsc.CMD --noEmit`
- Result: passed with exit code 0 from `apps/web`.

Diff hygiene:

- Command: `git diff --check -- apps/web/lib/search/featured-title.ts apps/web/lib/search/featured-title.test.mjs`
- Result: passed with no whitespace or conflict-marker issues.

Concerns:

- None within Task 3 scope.
