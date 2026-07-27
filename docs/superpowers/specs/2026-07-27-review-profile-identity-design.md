# Review Profile Identity and Profile Reviews Design

## Scope

Refine Kino's existing review feature without changing its review ownership constraints, permissions, title-page placement, like semantics, privacy model, title routes, React Query approach, or Open Graph infrastructure.

The identity correction applies to web and mobile review surfaces. The new Profile Reviews row and profile Open Graph changes apply to the web app only.

## Goals

- Use the authenticated user's Kino profile identity for every review presentation and optimistic state.
- Make published review authors navigable through Kino's canonical profile route.
- Replace the owner overflow menu with direct, accessible edit and delete controls.
- Add a responsive, paginated Reviews section to public web profiles.
- Add the authoritative published-review count to the profile Open Graph image.
- Keep title-page reviews, likes, permissions, privacy, and profile routing behavior intact.

## Identity Model

Core will expose a normalized review-author type and two shared helpers:

```ts
type KinoReviewAuthor = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

function toReviewAuthor(profile: UserProfile): KinoReviewAuthor;
function getReviewAuthorLabel(author: KinoReviewAuthor): string;
```

`getReviewAuthorLabel` uses `displayName?.trim() || username`, with a localized generic label supplied only by presentation code when neither public value exists. The username remains the route identity even when the display name is visible.

Review creation on web and mobile will load the current `user_profiles` row and pass `toReviewAuthor(profile)` to the optimistic mutation. It will not read `user_metadata`, email, provider name, provider nickname, or OAuth avatar fields. While the Kino profile is unavailable, the review identity area renders a compact skeleton and publishing remains disabled.

Persisted review responses continue to derive authors from `user_profiles`. This makes the optimistic and authoritative objects structurally identical and prevents an OAuth identity flash during reconciliation.

## Shared Review Presentation

The existing review presentation will be separated into reusable identity/header, body, like row, editor, and owner-action pieces rather than duplicated for profile cards.

Published authors use two independent canonical profile links:

- the avatar link;
- the emphasized author-name link following the localized “Reviewed by” text.

Both links use the existing profile-route normalization helper. Deleted or unavailable authors render as non-linking identity text and avatar fallback. Links have visible hover and focus states, and interaction handlers stop propagation when used inside profile cards.

Review-only ratings use the existing `RatingStars` small/read-only mode and preserve a numeric accessible label. No global star sizing changes are made.

Owner actions are adjacent ghost icon buttons:

- Pencil opens the existing inline editor.
- Trash opens the existing confirmation dialog.

Both buttons have accessible labels and desktop tooltips. Delete receives destructive hover and focus styling. Save and Cancel remain visible during edit mode. Buttons do not activate profile-card title navigation.

Title-page review text remains complete. Profile previews alone use whitespace-preserving, overflow-safe line clamping: approximately four lines on desktop and five on narrow screens.

## Profile Reviews Data

A dedicated database function will return profile reviews by canonical username. It will:

- join `reviews`, `user_profiles`, `titles`, and authoritative like aggregates in one grouped query;
- return only published, visible reviews allowed by existing profile, blocking, and privacy rules;
- order by `reviews.created_at DESC, reviews.id DESC`;
- use cursor pagination so edits do not change creation order;
- include title ID, TMDB ID, media type, canonical title, slug source, year, and poster path;
- include `likedByViewer` for authenticated callers without exposing private identity data;
- return an authoritative total count independently of page length.

Core will normalize the database rows into `ProfileReview` and `ProfileReviewsPage`. Stable keys will distinguish the overview and full pages:

```ts
["profile-reviews", username]
["profile-reviews", username, cursor]
```

The overview requests only the profile preview limit. The Show all dialog uses an infinite/paginated query and does not fetch one title at a time.

## Web Profile Reviews Section

The public profile page adds a Reviews section when at least one visible review exists. It follows the existing profile heading and dialog patterns but uses text-friendly cards instead of poster-shaped `TitleCard` elements.

Each card contains:

- title poster, title name, and release year;
- linked review avatar and linked author name;
- small review rating stars when present;
- clamped review text;
- authoritative like count and independent like control where permitted;
- optional creation date;
- direct owner edit/delete controls.

The title context is the card's primary destination. A stretched title link sits behind the card content, with a clear accessible label such as “Open review for {title}”. Interactive author, like, edit, and delete elements are positioned above it, avoiding nested anchors and preserving keyboard access.

Desktop uses a two-column grid of medium-width cards. Mobile uses one card per row. A limited preview is shown initially. When more results exist, a localized Show all control opens the existing focus-trapping profile dialog and restores focus when closed. The section is hidden when empty and uses review-shaped skeletons during its first load.

The profile's existing empty-state decision will include reviews, so a profile containing reviews but no watched-title or watchlist rows is not shown as globally empty.

## Mutation and Cache Behavior

Existing optimistic title-review behavior remains, with the author sourced from the Kino profile adapter.

Review creation and deletion invalidate or update:

- the affected title-review list and review detail;
- the current author's profile-review preview and modal pages;
- the public profile overview;
- review-count data;
- any existing title-user/community keys already maintained by the review hooks.

Editing updates title and profile review objects in place but does not reorder profile reviews. Like/unlike updates both title and profile review representations optimistically and restores both on failure.

Profile Open Graph responses keep their current bounded HTTP caching policy. Because the OG endpoint reads the authoritative database RPC on revalidation, create/delete changes appear after the existing cache window. Where the app already exposes explicit profile cache invalidation, create/delete will invoke it; global caching will not be disabled. Editing does not invalidate the OG image because the image displays only the count.

## Profile Open Graph

The existing `get_public_profile_og_data` function gains a `review_count` field counting published, non-deleted reviews visible for that profile. The server adapter exposes it as `reviews`, including a direct-query fallback for compatibility during migration rollout.

`ProfileOg` adds Reviews as a fourth compact statistic alongside Movies, Series, and Diary. The existing logo, banner, avatar, display name, username, bio, typography, and visual identity remain unchanged. Four evenly spaced metrics fit in the current single row without reducing text below social-preview readability. Zero is displayed consistently.

OG labels use the endpoint's existing locale behavior; the user-facing profile and review surfaces use the project's translation system.

## Localization and Accessibility

All supported locales will add or verify Reviews, Reviewed by, Edit review, Delete review, Read full review, Show all reviews, No reviews yet, Latest reviews, and pluralized review-count strings.

The implementation will verify:

- meaningful avatar alternative text;
- independent, focus-visible author links;
- numeric star descriptions;
- labelled icon buttons independent of tooltips;
- `aria-pressed` on like buttons;
- a descriptive title-link label;
- no parent navigation from nested controls;
- focus trapping and trigger restoration in Show all and delete dialogs.

## Error Handling

- Missing current Kino profile data prevents optimistic publication and shows the existing localized retry/error treatment.
- Profile-review query errors remain section-scoped and do not replace the whole profile.
- Optimistic edit, delete, and like changes snapshot all affected review caches and restore them on failure.
- Migration-compatible OG fallback returns zero reviews only when the upgraded RPC is unavailable; it does not fail the image.

## Verification

Tests will cover:

- author adapter and display-label behavior;
- absence of provider metadata in optimistic review construction;
- optimistic/live identity equality on web and mobile;
- profile-review mapping, ordering, pagination, permissions, privacy, and grouped title metadata;
- review-card navigation isolation and owner controls;
- cache updates and rollback across title/profile lists;
- OG review count and layout rendering;
- localization keys and pluralization;
- accessibility and responsive review-card behavior.

The final verification includes database migration checks, targeted review/profile/OG tests, lint, type-check, production build, and existing regression suites available in the repository.

