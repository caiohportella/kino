# Kino Web Hooks and Lib Reorganization

## Goal

Complete the partially applied reorganization of `apps/web/hooks` and `apps/web/lib` into feature-oriented domains without changing runtime behavior, query contracts, server/client boundaries, or unrelated work already present in the working tree.

## Target structure

Existing feature directories remain the primary boundaries:

- `hooks/activity/`, `hooks/profile/`, `hooks/title/`, and a new `hooks/reviews/` for domain hooks.
- `lib/activity/`, `lib/auth/`, `lib/localization/`, `lib/og/`, `lib/profile/`, `lib/search/`, `lib/supabase/`, and `lib/watchlist/` for existing domain modules.
- New `lib/title/`, `lib/seo/`, and `lib/tmdb/` folders for title query/prefetch, metadata/SEO, and TMDb integration modules.
- Root `lib` retains generic primitives and infrastructure such as date/text formatting, routes, query client, services, Supabase-independent utilities, and shared browser helpers.

The remaining root hooks move only when ownership is clear: followed-rating and media-poster hooks belong with title data, and the shared review-like mutation belongs under `hooks/reviews`. The horizontal-overflow hook remains root-level because it is a generic layout primitive.

## Import and boundary rules

All consumers, tests, scripts, and mock paths use the new direct paths. No compatibility re-exports or broad barrel files are added. Existing `use client` directives and server-only imports remain unchanged in meaning. Tests move with their feature modules where practical, and the web test script is updated so nested tests are actually discovered.

## Validation

Run stale-path searches across `apps/web`, then the existing web typecheck, lint, test, and build commands. Run the repository quality workflow if the focused checks pass. Any failure caused by unrelated pre-existing changes is reported separately.
