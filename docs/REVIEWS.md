# Reviews and Followed Ratings

Kino's title reviews are backed by Supabase tables and server-side RPCs. Web and mobile consume the same normalized `@kino/core` service APIs and React Query cache keys.

## Rollout

1. Back up the staging database.
2. Apply `database/migrations/2026-07-27-add-reviews-and-halfstar-ratings.sql` to staging.
3. Run `database/tests/reviews_and_halfstar_ratings.sql` against the staging test database.
4. Verify the RPCs and RLS policies with authenticated viewer, followed-user, community-user, and anonymous sessions.
5. Run the workspace checks listed below.
6. Deploy core, web, and mobile clients only after the database migration is live.

Example with `psql`:

```powershell
psql $env:KINO_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/migrations/2026-07-27-add-reviews-and-halfstar-ratings.sql
psql $env:KINO_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/tests/reviews_and_halfstar_ratings.sql
```

The migration changes `title_ratings` and `episode_ratings` to accept `0.5` through `5.0` in half-star increments. Legacy tenth-star values are rounded to the nearest half before the new constraints are validated—for example, `4.2` becomes `4.0` and `4.3` becomes `4.5`. Apply it to staging first and keep a database backup because this normalization updates existing rating rows and client deployments expect the new RPCs.

## Data model

`reviews` contains one plain-text review per `(user_id, title_id)`. Its `media_type` is checked against `titles.type` by a database trigger. Content is trimmed and constrained to 1–2,000 characters.

`review_likes` uses `(review_id, user_id)` as its primary key. Likes cascade when a review or account is deleted. The like RPC rejects self-likes, and RLS independently prevents direct self-like inserts.

All rating columns use `NUMERIC(2,1)` with both range and half-step constraints:

```sql
rating BETWEEN 0.5 AND 5
AND rating * 2 = round(rating * 2)
```

Kino retains rating rows for rewatches. The canonical current title rating is the latest row by `watched_at DESC, updated_at DESC, id DESC`.

## Snapshot semantics

`create_review` and `update_review` always read the review author's latest canonical `title_ratings` row and copy that value into `reviews.rating`. The `p_rating` argument remains nullable for RPC compatibility but is not trusted. If no title rating exists, the review snapshot is `NULL`.

Editing a title rating changes `title_ratings` only. A review snapshot changes on the next review edit; it does not mutate diary entries or watch timestamps.

## RPCs

```text
create_review(p_user_id, p_title_id, p_media_type, p_content, p_rating)
update_review(p_review_id, p_user_id, p_content, p_rating)
delete_review(p_review_id, p_user_id)
like_review(p_review_id)
unlike_review(p_review_id)
get_title_reviews(p_title_id, p_viewer_id, p_limit, p_cursor)
get_followed_title_ratings(p_title_id, p_limit)
get_followed_episode_ratings(p_title_id, p_season_number, p_per_episode_limit)
```

Write RPCs validate `auth.uid()` and ownership. Viewer-specific read RPCs derive the effective viewer from `auth.uid()` rather than trusting a supplied viewer ID.

Title review ordering is:

1. viewer review;
2. reviews from users the viewer follows;
3. community reviews.

Within a tier, results use like count descending, creation time descending, then review ID ascending. Pagination is keyset-based with:

```json
{
  "tier": 1,
  "like_count": 12,
  "created_at": "2026-07-27T12:00:00Z",
  "id": "00000000-0000-0000-0000-000000000000"
}
```

The season RPC returns one grouped response:

```ts
type FollowedEpisodeRatingsResponse = {
  episodes: Record<string, FollowedRating[]>
  totals: Record<string, number>
}
```

Keys use `seasonNumber:episodeNumber`. Web and mobile issue one query per selected season, never one request per episode.

## Client API

Shared types, row mapping, validation, query keys, cache helpers, and `KinoDatabaseService` methods live in:

- `packages/core/src/reviews.ts`
- `packages/core/src/review-cache.ts`
- `packages/core/src/database.ts`

Stable keys are:

```ts
['title-reviews', titleId]
['review', reviewId]
['followed-title-ratings', titleId]
['followed-episode-ratings', seriesId, seasonNumber]
```

Platform hooks optimistically create, edit, delete, like, and unlike reviews. They snapshot matching cache entries before mutation, restore them on failure, and invalidate authoritative queries when settled.

## UI placement

Web movie pages show followed-user ratings inside Community Ratings, then Reviews immediately before More Like This. Series pages keep Community Ratings in the sidebar but place Reviews in the main full-width flow immediately before More Like This.

Mobile shows compact followed movie ratings, grouped episode ratings, and Reviews in the title content without replacing personal rating, watched state, progress, or air-date controls.

The review hierarchy follows the supplied reference: avatar; localized “Reviewed by,” author, and rating; readable review body; compact heart action and secondary authoritative count. Styling uses Kino's existing dark surfaces, typography, spacing, radii, and green active state.

## Verification

```powershell
pnpm typecheck
pnpm lint
pnpm --filter @kino/core test
pnpm --filter @kino/web test
pnpm build
```

Manual staging acceptance:

- publish a review with and without a canonical rating;
- confirm duplicate review and media mismatch rejection;
- edit and delete the viewer review;
- like/unlike another review and confirm self-like rejection;
- confirm optimistic rollback after forced mutation failures;
- confirm viewer/followed/community ordering and pagination;
- follow/unfollow a movie rater and confirm the subsection appears/disappears;
- confirm season changes make one grouped episode-rating request;
- confirm episode ratings never appear on the wrong episode;
- confirm Reviews appears before More Like This at 320 px and desktop widths;
- confirm review edits do not alter diary order.
