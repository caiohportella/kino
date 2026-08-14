# Kino Title Detail Refactor Design

## Goal

Make movie and TV title pages read as one cohesive detail document rather than a stack of independent cards, while preserving existing title data, mutations, dialogs, localization, routes, and responsive behavior.

## Design

The local `apps/web` tree is the source of truth and already contains partial embedded variants for the title sidebar, external services, trailer, providers, and reviews. Add one shared `TitleSection` primitive for page-level rhythm, optional semantic headings, and subtle dividers. Keep the existing hero unchanged, then compose a continuous main column beside the existing single contextual sidebar. Render recommendations below the two-column area so the shelf can use the full content frame.

Synopsis, personal activity, community ratings, franchise, and reviews become flat structural sections. Individual stat tiles and review cards remain surfaces. TV seasons keep their tabs and all existing state/mutations, but the season header and episode list lose structural card wrappers; episode rows use spacing, separators, hover, and focus states.

The sidebar remains one outer surface containing embedded trailer, providers, external links, and credits. Standalone variants stay available for other consumers. No fetching, TMDb behavior, ratings math, diary persistence, episode logic, routes, or localization architecture changes.

## Constraints

- Preserve existing behavior, async states, translations, accessibility, and responsive layouts.
- Do not introduce hard-coded user-facing English strings.
- Limit source changes to title-detail components and the new structural primitive; leave unrelated dirty files untouched.

## Verification

Run the repository's web quality scripts, TypeScript check, formatter/linter, relevant title/review tests, and inspect the final diff for accidental scope expansion.
