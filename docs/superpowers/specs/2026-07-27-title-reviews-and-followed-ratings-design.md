# Title Reviews and Followed Ratings Design

## Summary

Kino will add a complete review experience to movie and series title pages and bring the mobile app's followed-user rating context to the web. Reviews sit in the main title flow immediately before **More Like This**. Movie Community Ratings gains a subordinate **From People You Follow** subsection, while series episode rows gain compact episode-specific followed-user ratings.

The implementation extends Kino's existing Supabase data model, shared `@kino/core` database service, React Query client architecture, Base UI/shadcn component vocabulary, five-locale translation system, and restrained dark/green visual language.

## Decisions

- A user may publish one review per title and media type.
- A review may be published without a rating.
- The review stores a nullable snapshot of the user's latest canonical title rating when the review is created or edited.
- Ratings across titles, episodes, and review snapshots accept 0.5 through 5.0 in half-star increments.
- Review content is plain text, trimmed on the server, and limited to 2,000 characters.
- Users cannot like their own reviews. This is enforced in the interface and on the server.
- The title page shows a bounded review preview. The viewer's review is always first, followed-user reviews come next, and popular/recent community reviews come last.
- Episode social ratings always come from `episode_ratings`; overall series ratings are never substituted.
- Existing watch-history timestamps and diary ordering remain independent from review timestamps.

## Data Model

### Reviews

Add a `reviews` table:

```sql
reviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  content text not null check (
    char_length(btrim(content)) between 1 and 2000
  ),
  rating numeric(2, 1) null check (
    rating between 0.5 and 5
    and rating * 2 = round(rating * 2)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title_id)
)
```

Indexes cover `(title_id, created_at desc, id)`, `user_id`, and the unique ownership lookup. A trigger updates `updated_at` without touching diary or watch-history records. The title's stored type must match `media_type`.

RLS allows public reads of review data that is already public in Kino. Authenticated users can insert only their own review, and only the author can update or delete it. Server functions re-check ownership and media type. Deleted accounts cascade their reviews so no orphaned author cards remain.

### Review Likes

Add a `review_likes` table:

```sql
review_likes (
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
)
```

The primary key enforces one like per user per review and indexes both review lookup and duplicate prevention. Add a user index for account cleanup and future activity queries. A trigger or security-definer mutation function rejects likes where the review author equals the viewer. Counts are computed with `count(*)` in grouped server queries and never inferred from a paginated array.

### Existing Ratings

`title_ratings` remains the source for movie title ratings. `episode_ratings` remains the source for series episode ratings. Both use the 0.5–5.0 half-step domain. Because these tables preserve rewatches, the canonical current rating and followed-rating queries choose the most recent row per user and entity using `watched_at desc, updated_at desc, id desc`.

No new episode rating table is needed: Kino already stores `title_id`, `season_number`, `episode_number`, and `rating` distinctly.

## Server Queries and Mutations

The shared `@kino/core` database service exposes normalized methods over Supabase RPCs and table mutations.

### Review Query

`getTitleReviews(mediaType, titleId, { cursor, limit })` returns:

```ts
type TitleReviewsPage = {
  items: Review[];
  nextCursor: string | null;
  totalCount: number;
};
```

Each `Review` contains the public author summary, authoritative `likeCount`, `likedByViewer`, `isViewerReview`, and timestamps. The SQL query groups likes once, joins the viewer's follow relation once, and assigns ordering tiers:

1. Viewer review
2. Authors the viewer follows
3. Community reviews

Within the viewer tier there is one row. Followed reviews are ordered by recency. Community reviews are ordered by like count and then recency. Cursor pagination uses a stable tuple containing tier, popularity, timestamp, and review ID.

Anonymous viewers receive community reviews without viewer-specific like/follow state. The title page requests a small preview limit; the dialog paginates the complete set with the same ordering.

### Review Mutations

- `createReview(titleId, mediaType, content)` validates the authenticated user, uniqueness, title type, content, and reads the user's latest relevant title rating for the snapshot. It never trusts a client-supplied review rating.
- `updateReview(reviewId, content)` validates ownership and refreshes the nullable rating snapshot.
- `deleteReview(reviewId)` validates ownership and cascades likes.
- `likeReview(reviewId)` validates authentication, rejects self-likes, and relies on the unique key for duplicate safety.
- `unlikeReview(reviewId)` deletes only the viewer's like.

All permission rules exist server-side even when the interface hides unavailable actions.

### Followed Movie Ratings

`getFollowedTitleRatings('movie', titleId, { limit })` performs one grouped query:

- starts from Kino's `follows` relation where `follower_id = auth.uid()` and the followed account is in `following_id`;
- excludes the viewer;
- joins public user profile fields only;
- selects the latest public title rating per followed user;
- excludes missing ratings and any relationship filtered by Kino's privacy/block rules;
- returns an authoritative total and a bounded list.

The current schema has public ratings and no block/privacy table. The query is structured through a dedicated RPC so future visibility or blocking relations can be added in one server-side predicate without changing clients.

### Followed Episode Ratings

`getFollowedEpisodeRatings(seriesId, seasonNumber, { perEpisodeLimit })` performs one season-scoped query and returns:

```ts
type FollowedEpisodeRatingsResponse = {
  episodes: Record<string, FollowedRating[]>;
  totals: Record<string, number>;
};
```

Keys use `seasonNumber:episodeNumber`. The RPC filters followed users once, restricts `episode_ratings` to the title and selected season, selects each user's latest rating per episode, joins public profiles, and groups the result in one response. No request is issued per episode.

## Shared Types and Query Keys

Add normalized shared types for `Review`, `ReviewLikeSummary`, `TitleReviewsPage`, `PublicUserSummary`, `FollowedRating`, and `FollowedEpisodeRatingsResponse`.

Web query-key factories produce:

```ts
reviewKeys.title(mediaType, titleId)
reviewKeys.detail(reviewId)
ratingKeys.followedTitle(mediaType, titleId)
ratingKeys.followedEpisodes(seriesId, seasonNumber)
```

Their serialized shapes remain:

```ts
['title-reviews', mediaType, titleId]
['review', reviewId]
['followed-title-ratings', mediaType, titleId]
['followed-episode-ratings', seriesId, seasonNumber]
```

## React Query Mutation Behavior

Review create/edit/delete and like/unlike mutations cancel matching queries, snapshot previous cache values, update all visible review pages optimistically, and restore snapshots on error.

- Create replaces the composer with the pending viewer review while preserving the textarea text until success.
- Edit preserves original text and restores the original review on failure.
- Delete removes the review immediately, decrements totals, closes editing state, and restores the review and totals on failure.
- Like/unlike updates `likedByViewer` and `likeCount` immediately. Mutation buttons are disabled while pending to prevent mutation spam.
- Settled mutations invalidate title reviews and review details. Cache helpers also cover future profile activity and title community keys without forcing a page refresh.

Rating mutations continue to update personal and aggregate caches and also invalidate the relevant followed-rating keys so another viewer receives fresh social data when their backend session revalidates.

## Web Components and Placement

### Reviews

Create a focused Reviews component family rather than expanding the already large title page:

- `ReviewsSection`: query boundary, heading, preview ordering, empty states, composer/review switching, and show-all trigger.
- `ReviewComposer`: compact avatar/author/rating row, textarea, character feedback, validation, and publish action.
- `ReviewCard`: semantic author metadata, body, timestamp, like row, and owner actions.
- `ReviewEditor`: inline text editor with Save and Cancel.
- `ReviewActionsMenu`: accessible overflow menu and delete confirmation.
- `ReviewsDialog`: paginated expanded review list using the existing focus-trapping dialog component.
- `ReviewSkeleton`: avatar, author, stars, body lines, and action placeholder.

The section is inserted in the main content flow immediately before `MoreLikeThis` for both movies and series. It never appears in the series sidebar.

The screenshot informs information hierarchy only: avatar left; localized “Reviewed by,” linked username, and stars on the top line; readable review text below; compact heart action and secondary count beneath. Kino's own dark surfaces, green accent, typography, radii, focus treatment, and subtle separators replace the reference's styling.

Review prose is limited to approximately 70 characters per line. Metadata wraps below the username on narrow screens. The layout remains usable at 320 px without hiding the author or rating.

### Followed Movie Ratings

`FollowedTitleRatings` is rendered inside the existing Community Ratings block, after aggregate average/distribution/count content. It uses small existing avatars, profile links, compact readonly stars, a bounded list, skeleton rows, and an existing dialog for “Show all.” It renders nothing when the authenticated viewer has no followed ratings.

### Followed Episode Ratings

`FollowedEpisodeRatings` is added to each episode row without changing the personal rating/watch controls. It consumes the single season-level query from the season component and receives only the relevant keyed array.

One or two ratings render as compact avatar/name/star rows. Larger sets use the existing avatar-group vocabulary plus an accessible count trigger opening a focused dialog. Episodes with no social ratings render no placeholder and retain their current height.

## Authentication, Privacy, and Accessibility

- Composer and mutations require authentication.
- Anonymous viewers see “Sign in to write a review.” Like attempts use Kino's existing authentication redirect/prompt pattern.
- Avatar and username links use public profile routes and keyboard-visible focus.
- Avatars have author-specific alternative text; decorative fallbacks remain hidden appropriately.
- Readonly stars expose localized textual values such as “4 out of 5.”
- Like buttons use `aria-pressed`; overflow controls have explicit labels.
- Success and error toasts serve as polite status announcements.
- Dialogs use the existing focus trap and restore focus to their triggers.
- Review body content renders as text, never `dangerouslySetInnerHTML`.
- Server query boundaries are the enforcement point for future blocked-user and hidden-rating rules.

## Localization

Add all requested review, like, empty-state, status, followed-rating, edited, and failure copy to English, Portuguese, French, Italian, and Norwegian resources.

Like counts use Kino's plural-key resolver with locale-appropriate singular and plural entries. New UI code never supplies raw translation keys as visible fallback copy. Rating accessibility labels and character-limit errors are localized as well.

## Loading, Error, and Empty States

Reviews and followed ratings use section-local skeletons. Episode rows do not show a full-page spinner.

Query failure keeps the surrounding title page operational and shows a compact localized retry state within the affected section. Mutation failures roll back optimistic state and show localized error toasts.

When there are no reviews:

- authenticated viewers see the compact composer and “Be the first to review this title” support text;
- anonymous viewers see “Sign in to write a review.”

## Validation Strategy

### Database and Service Tests

- migration applies and constraints reject duplicate reviews, duplicate likes, self-likes, invalid media type, mismatched title type, empty content, oversized content, and unauthorized changes;
- review deletion cascades likes;
- review queries return authoritative counts and correct viewer state;
- ordering tiers and cursor pagination are stable;
- followed movie ratings exclude viewer/non-followed/unrated users;
- followed episode ratings remain episode-specific and grouped by season.

### Client Tests

- optimistic create, edit, delete, like, and unlike update every matching cache page;
- mutation failure restores content, counts, and liked state;
- pending states prevent duplicate submissions while preserving typed text;
- ownership gates edit/delete actions;
- empty states and authentication prompts are correct;
- pluralization and all locale keys resolve;
- semantic headings, accessible names, pressed state, focus management, and star labels pass accessibility checks.

### Integration and Visual Verification

- publish with and without a rating, edit, delete, like, and unlike;
- confirm Reviews appears immediately before More Like This on movie and series pages;
- confirm followed movie ratings appear below aggregate Community Ratings and disappear after unfollow/cache refresh;
- confirm season changes issue one grouped social query and ratings never leak across episodes;
- verify watched state, progress, air date, personal ratings, diary ordering, and aggregate ratings regressions;
- verify responsive layouts at 320 px, common mobile widths, tablet, and desktop;
- run migrations, lint, type-check, targeted tests, localization tests, accessibility checks, responsive browser checks, and the production build.

## Scope Boundaries

- Reviews are title-level only; episode reviews are not introduced.
- Rich text, spoilers, comments, review feeds, moderation tooling, and notifications are not added.
- Profile review activity is not displayed yet, but cache keys and timestamps remain compatible with it.
- Existing schema does not currently model blocked users or hidden ratings. This feature does not invent client-only privacy flags; it centralizes visibility queries so those product capabilities can be enforced server-side when their canonical relations exist.
