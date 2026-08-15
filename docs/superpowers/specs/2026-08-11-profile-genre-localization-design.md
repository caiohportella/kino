# Profile Genre Localization

## Goal

Display genre names in the user's selected Kino language anywhere profile/statistics UI renders genre analytics.

TMDb genre IDs already exist as locale keys, so localization must be ID-based rather than translating persisted English genre names.

## Core analytics

`calculateProfileRatingStats()` remains locale-agnostic.

`ProfileRatedCategoryStat` will expose the TMDb genre ID when the category represents a genre:

- `id`
- `name`
- `average`
- `count`
- `titleCount`

Genre ranking continues using the existing semantics:

- Most-rated genre: highest distinct `titleCount`
- Highest-rated genre: average of per-title averages
- Highest-rated genre requires at least 3 distinct titles

No translation logic belongs in `@kino/core`.

## UI localization

Add a reusable helper for resolving genre labels from the existing locale namespace:

`genres.${genreId}`

Example:

- ID `99`
- persisted fallback: `Documentary`
- pt locale: `genres.99 = Documentário`
- rendered label: `Documentário`

If a translation does not exist, fall back to the persisted TMDb genre name.

## Ratings card

Both:

- Most-rated genre
- Highest-rated genre

use the localized genre name.

Existing counts and averages are unchanged.

## Testing

Core tests verify genre stats retain their TMDb ID.

Web localization tests verify:

- the Ratings card resolves genres by ID;
- the persisted English name is not the primary localization mechanism;
- a fallback name remains available when a locale entry is missing.

Existing locale files remain the single source of truth for translated genre names.
