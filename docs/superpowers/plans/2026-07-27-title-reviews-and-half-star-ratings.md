# Title Reviews and Half-Star Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-enforced title reviews, review likes, half-star rating constraints, followed-user rating RPCs, shared service APIs, optimistic web/mobile hooks, localized title-page review UI, and verification documentation.

**Architecture:** Supabase remains the permission and aggregation boundary through RLS and narrowly granted `SECURITY DEFINER` RPCs. `@kino/core` owns normalized types, query keys, validation, row mapping, and database-service methods; web and mobile own thin React Query hooks and platform UI. Reviews snapshot the latest canonical `title_ratings` row on create/update, while rewatch history remains intact.

**Tech Stack:** PostgreSQL/Supabase SQL, TypeScript 5.9, `@supabase/supabase-js`, React 19, React Query 5, Next.js 15, Expo/React Native, Base UI/shadcn, Node test runner, Biome.

## Global Constraints

- Ratings use `NUMERIC(2,1)` and accept only `0.5 <= rating <= 5.0` in 0.5 increments.
- Reviews are unique on `(user_id, title_id)` and contain plain text of 1–2,000 trimmed characters.
- Review ratings are nullable snapshots read from the latest `title_ratings` row; clients cannot create a divergent rating.
- `follows(follower_id, following_id)` is Kino's canonical follow relation.
- Users cannot like their own reviews.
- All ownership and self-like checks are enforced server-side.
- Review pagination uses the cursor `{ tier, like_count, created_at, id }`.
- Preserve existing rewatch rows, diary ordering, episode controls, and aggregate rating behavior.
- Do not render review HTML.

---

### Task 1: Database constraints, review tables, and permission-safe RPCs

**Files:**
- Create: `database/migrations/2026-07-27-add-reviews-and-halfstar-ratings.sql`
- Create: `database/tests/reviews_and_halfstar_ratings.sql`
- Modify: `database/schema.sql`

**Interfaces:**
- Consumes: existing `titles`, `title_ratings`, `episode_ratings`, `user_profiles`, and `follows` tables.
- Produces: `reviews`, `review_likes`, `create_review`, `update_review`, `delete_review`, `like_review`, `unlike_review`, `get_title_reviews`, `get_followed_title_ratings`, and `get_followed_episode_ratings`.

- [ ] **Step 1: Write failing SQL assertions**

Create a transactional SQL test that inserts fixture users/titles/follows and asserts:

```sql
DO $$
BEGIN
  BEGIN
    INSERT INTO title_ratings (user_id, title_id, rating, watch_type, watched_at)
    VALUES (v_user, v_title, 0.3, 'first-time', now());
    RAISE EXCEPTION '0.3 unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
```

Repeat for accepted `0.5`, rejected `0`, rejected `5.5`, duplicate review rejection, media mismatch, canonical snapshot, self-like rejection, cascading likes, and viewer/followed/community tier order. Roll back the fixture transaction.

- [ ] **Step 2: Verify the SQL test fails before the migration**

Run:

```powershell
psql $env:KINO_TEST_DATABASE_URL -v ON_ERROR_STOP=1 -f database/tests/reviews_and_halfstar_ratings.sql
```

Expected: failure because `reviews` and its RPCs do not exist. If no test database URL is configured, parse the migration locally and record the integration test as environment-blocked rather than inventing credentials.

- [ ] **Step 3: Implement the migration**

The migration must:

```sql
ALTER TABLE title_ratings DROP CONSTRAINT IF EXISTS title_ratings_rating_check;
ALTER TABLE title_ratings
  ADD CONSTRAINT title_ratings_rating_range_step_check
  CHECK (rating BETWEEN 0.5 AND 5 AND rating * 2 = round(rating * 2));

ALTER TABLE episode_ratings DROP CONSTRAINT IF EXISTS episode_ratings_rating_check;
ALTER TABLE episode_ratings
  ADD CONSTRAINT episode_ratings_rating_range_step_check
  CHECK (rating BETWEEN 0.5 AND 5 AND rating * 2 = round(rating * 2));
```

Create `reviews` with `UNIQUE(user_id, title_id)` and a named nullable half-step check. Create `review_likes` with `(review_id, user_id)` primary key and cascading foreign keys. Add title/author/like indexes and a `reviews_set_updated_at` trigger.

Write `assert_review_media_type_matches_title` and a table trigger so direct inserts cannot bypass title-type validation. Write mutation RPCs with `SET search_path = public`, `auth.uid()` equivalence checks, trimmed content validation, and canonical rating selection:

```sql
SELECT tr.rating
INTO v_rating
FROM title_ratings tr
WHERE tr.user_id = p_user_id AND tr.title_id = p_title_id
ORDER BY tr.watched_at DESC, tr.updated_at DESC, tr.id DESC
LIMIT 1;
```

Ignore client rating input for persistence. Reject self-like using `auth.uid()`. Grant execution only to `authenticated` where writes are involved.

Implement review keyset pagination with explicit descending comparisons:

```sql
WHERE p_cursor IS NULL
   OR tier > c_tier
   OR (tier = c_tier AND like_count < c_like_count)
   OR (tier = c_tier AND like_count = c_like_count AND created_at < c_created_at)
   OR (tier = c_tier AND like_count = c_like_count AND created_at = c_created_at AND id > c_id)
ORDER BY tier, like_count DESC, created_at DESC, id
LIMIT greatest(1, least(p_limit, 50)) + 1;
```

Return authoritative `total_count` and one extra row so the client can form `nextCursor`. Use `follows` in tier and followed-rating queries. In season RPC output, key episodes as `seasonNumber:episodeNumber`, include per-episode totals, and use `DISTINCT ON` to select the latest rating per user/entity.

- [ ] **Step 4: Update canonical schema**

Mirror the final table definitions, constraints, indexes, functions, grants, triggers, RLS enablement, and policies in `database/schema.sql`, with a comment pointing to the migration.

- [ ] **Step 5: Verify migration quality**

Run:

```powershell
rg -n "followings|followed_id|p_user_id.*like_review|rating BETWEEN 1" database/migrations/2026-07-27-add-reviews-and-halfstar-ratings.sql database/schema.sql
git diff --check -- database
```

Expected: no stale follow identifiers, no client-supplied like user, no old rating floor, and no whitespace errors.

- [ ] **Step 6: Run SQL tests when configured**

Run the migration and test against `$env:KINO_TEST_DATABASE_URL`; expect every assertion to pass and the transaction to roll back.

- [ ] **Step 7: Commit database work**

```powershell
git add database/migrations/2026-07-27-add-reviews-and-halfstar-ratings.sql database/tests/reviews_and_halfstar_ratings.sql database/schema.sql
git commit -m "feat(db): add reviews and half-star rating rules"
```

### Task 2: Shared review types, query keys, validation, and service methods

**Files:**
- Create: `packages/core/src/reviews.ts`
- Create: `packages/core/src/reviews.test.mjs`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/database.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Consumes: RPC signatures from Task 1 and `KinoDatabaseService`'s existing Supabase client.
- Produces: `Review`, `PublicUserSummary`, `ReviewCursor`, `TitleReviewsPage`, `FollowedRating`, `FollowedEpisodeRatingsResponse`, `reviewKeys`, `ratingKeys`, `isValidHalfStepRating`, and seven service methods.

- [ ] **Step 1: Write failing mapper and validation tests**

Test:

```js
assert.equal(isValidHalfStepRating(null), true)
assert.equal(isValidHalfStepRating(0.5), true)
assert.equal(isValidHalfStepRating(4.5), true)
assert.equal(isValidHalfStepRating(0.3), false)
assert.deepEqual(reviewKeys.title('abc'), ['title-reviews', 'abc'])
```

Mock Supabase's `rpc()` and verify exact RPC names/arguments, row mapping from snake case, extra-row cursor calculation, trimmed content, error propagation, and viewer identity obtained by the service instead of trusted from UI parameters.

- [ ] **Step 2: Run the focused test and observe failure**

```powershell
node --test --experimental-strip-types packages/core/src/reviews.test.mjs
```

Expected: module exports and service methods are missing.

- [ ] **Step 3: Add normalized shared review module**

Define camel-case application types:

```ts
export interface Review {
  id: string
  userId: string
  titleId: string
  mediaType: 'movie' | 'tv'
  content: string
  rating: number | null
  likeCount: number
  likedByViewer: boolean
  createdAt: string
  updatedAt: string
  author: PublicUserSummary
  isViewerReview: boolean
  tier: 0 | 1 | 2
}
```

Add pure row mappers, cursor creation, half-step validation, and stable query keys. Export the module from `src/index.ts`.

- [ ] **Step 4: Add service methods**

Implement:

```ts
createReview(titleId, mediaType, content): Promise<Review>
updateReview(reviewId, content): Promise<Review>
deleteReview(reviewId): Promise<void>
likeReview(reviewId): Promise<void>
unlikeReview(reviewId): Promise<void>
getTitleReviews(titleId, limit?, cursor?): Promise<TitleReviewsPage>
getFollowedTitleRatings(titleId, limit?): Promise<FollowedRatingsPage>
getFollowedEpisodeRatings(titleId, seasonNumber, perEpisodeLimit?): Promise<FollowedEpisodeRatingsResponse>
```

Each write method gets the authenticated user internally where the RPC requires an ownership parameter. Validate/trim content client-side for immediate feedback, but rely on the RPC for permission enforcement. Throw Supabase errors unchanged.

- [ ] **Step 5: Run focused and package checks**

```powershell
node --test --experimental-strip-types packages/core/src/reviews.test.mjs
pnpm --filter @kino/core typecheck
```

Expected: tests and type-check pass.

- [ ] **Step 6: Commit core work**

```powershell
git add packages/core
git commit -m "feat(core): add review and followed-rating services"
```

### Task 3: Optimistic cache helpers and web/mobile React Query hooks

**Files:**
- Create: `packages/core/src/review-cache.ts`
- Create: `packages/core/src/review-cache.test.mjs`
- Create: `apps/web/hooks/use-title-reviews.ts`
- Create: `apps/web/hooks/use-followed-ratings.ts`
- Create: `apps/mobile/hooks/data/useTitleReviews.ts`
- Create: `apps/mobile/hooks/data/useFollowedRatings.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 2 types, keys, and database methods.
- Produces: immutable cache update helpers and platform hooks with rollback contexts.

- [ ] **Step 1: Write failing optimistic-cache tests**

Cover insertion at tier zero, text update across pages, deletion/total decrement, like/unlike count clamping, and exact rollback snapshot restoration:

```js
const liked = updateReviewLike(page, 'review-1', true)
assert.equal(liked.items[0].likeCount, 2)
assert.equal(liked.items[0].likedByViewer, true)
assert.deepEqual(updateReviewLike(liked, 'review-1', false), page)
```

- [ ] **Step 2: Run the cache test and observe failure**

```powershell
node --test --experimental-strip-types packages/core/src/review-cache.test.mjs
```

Expected: cache helpers do not exist.

- [ ] **Step 3: Implement pure immutable cache helpers**

Add `insertViewerReview`, `replaceReview`, `removeReview`, and `updateReviewLike` without React dependencies. Preserve page shape and avoid negative totals/counts.

- [ ] **Step 4: Implement web hooks**

Use `useQuery`, `useInfiniteQuery` for the dialog, and mutations that:

```ts
await queryClient.cancelQueries({ queryKey: reviewKeys.title(titleId) })
const previous = queryClient.getQueriesData({ queryKey: reviewKeys.title(titleId) })
queryClient.setQueriesData({ queryKey: reviewKeys.title(titleId) }, updater)
return { previous }
```

Restore every `[queryKey, data]` pair on error, disable duplicate submissions through `isPending`, invalidate title/detail/community/profile keys on settle, and keep mutation variables free of user IDs.

- [ ] **Step 5: Implement mobile hooks**

Use the same core keys/helpers and the mobile database service/auth conventions. Keep the API equivalent to web so platform components can share behavior expectations.

- [ ] **Step 6: Verify helpers and both apps**

```powershell
node --test --experimental-strip-types packages/core/src/review-cache.test.mjs
pnpm --filter @kino/core typecheck
pnpm --filter @kino/web typecheck
pnpm --filter @kino/mobile typecheck
```

Expected: all pass.

- [ ] **Step 7: Commit hooks and cache helpers**

```powershell
git add packages/core/src/review-cache* packages/core/src/index.ts apps/web/hooks apps/mobile/hooks/data
git commit -m "feat: add optimistic review query hooks"
```

### Task 4: Localized web review and followed-rating UI

**Files:**
- Create: `apps/web/components/reviews/review-author.tsx`
- Create: `apps/web/components/reviews/review-composer.tsx`
- Create: `apps/web/components/reviews/review-editor.tsx`
- Create: `apps/web/components/reviews/review-card.tsx`
- Create: `apps/web/components/reviews/reviews-dialog.tsx`
- Create: `apps/web/components/reviews/review-skeleton.tsx`
- Create: `apps/web/components/reviews/reviews-section.tsx`
- Create: `apps/web/components/followed-ratings.tsx`
- Create: `apps/web/lib/review-view-model.test.mjs`
- Create: `apps/web/lib/review-view-model.ts`
- Modify: `apps/web/app/title/[id]/page.tsx`
- Modify: `apps/web/components/rating-stars.tsx`
- Modify: `locales/en/translation.json`
- Modify: `locales/pt/translation.json`
- Modify: `locales/fr/translation.json`
- Modify: `locales/it/translation.json`
- Modify: `locales/no/translation.json`

**Interfaces:**
- Consumes: Task 3 hooks, existing Avatar/RatingStars/Button/DropdownMenu/Dialog/Skeleton/AlertDialog/Toast primitives, auth redirect pattern, and profile routes.
- Produces: complete web Reviews section, movie followed ratings, and episode-level followed ratings.

- [ ] **Step 1: Write failing view-model and localization tests**

Test whitespace validation, 2,000-character boundary, remaining-character threshold, edited timestamp selection, singular/plural like keys, and presence of every new key in all five resources.

- [ ] **Step 2: Run focused web tests and observe failure**

```powershell
node --test --experimental-strip-types apps/web/lib/review-view-model.test.mjs apps/web/lib/i18n-plural.test.mjs
```

Expected: review view-model and locale keys are missing.

- [ ] **Step 3: Add localized copy**

Add nested `reviews` keys for section/composer/actions/validation/status/empty/show-all/followed-rating/timestamps and `_one`/`_other` like-count keys compatible with Kino's plural resolver. Translate all keys into en/pt/fr/it/no; never use a raw-key visible fallback.

- [ ] **Step 4: Build the review component family**

Implement compact semantic components with:

- existing Avatar and profile links;
- “Reviewed by” plus readonly half-star display;
- textarea with preserved text, 2,000-character limit, and remaining count only at 200 or fewer;
- inline edit Save/Cancel;
- owner-only overflow menu and AlertDialog delete confirmation;
- plain-text body with `whitespace-pre-wrap` and approximately `70ch` line length;
- `aria-pressed` heart button, filled green liked state, disabled pending state, and localized authoritative count;
- paginated existing Dialog for “Show all reviews”;
- section-local skeleton and compact empty/auth prompt.

- [ ] **Step 5: Add followed-rating components**

Movie rows show avatar/name profile links and readonly stars below aggregate Community Ratings. Episode rows consume a single season query, show at most two compact ratings, then an accessible avatar-group count/dialog without changing watched/personal-rating controls.

- [ ] **Step 6: Integrate title-page placement**

Extract only the minimum props from the large title page. Render:

```tsx
<CommunityRatings ... />
<ReviewsSection mediaType={title.type} titleId={title.id} />
<MoreLikeThis ... />
```

For series, keep Reviews in the main column and pass the selected-season grouped followed-rating map into episode rows. Do not place Reviews in the sidebar.

- [ ] **Step 7: Verify web behavior**

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/web typecheck
pnpm --filter @kino/web lint
```

Expected: tests, type-check, and lint pass.

- [ ] **Step 8: Commit web UI and locales**

```powershell
git add apps/web locales
git commit -m "feat(web): add title reviews and social ratings"
```

### Task 5: Mobile Reviews section and grouped social-rating integration

**Files:**
- Create: `apps/mobile/components/reviews/ReviewComposer.tsx`
- Create: `apps/mobile/components/reviews/ReviewCard.tsx`
- Create: `apps/mobile/components/reviews/ReviewEditor.tsx`
- Create: `apps/mobile/components/reviews/ReviewsSection.tsx`
- Create: `apps/mobile/components/reviews/ReviewSkeleton.tsx`
- Modify: `apps/mobile/app/title/[id].tsx`
- Modify: `apps/mobile/components/title/FriendRatings.tsx`
- Modify: `apps/mobile/components/title/SeasonSection.tsx`
- Modify: `apps/mobile/components/common/RatingStars.tsx`

**Interfaces:**
- Consumes: Task 3 mobile hooks and existing mobile avatar, modal, toast, navigation, and rating patterns.
- Produces: compact mobile title Reviews and grouped followed episode/title ratings using the shared backend.

- [ ] **Step 1: Add half-star display and accessible labels**

Update mobile RatingStars so readonly fractional values clip/fill correctly and interactive steps use 0.5 increments where rating selection is available. Add localized accessibility values.

- [ ] **Step 2: Build mobile review components**

Mirror web behavior with React Native controls: compact author row, preserved 2,000-character composer, inline editor, confirmation before deletion, optimistic like button with accessibility state, and bounded preview. Reuse the existing modal convention for show-all instead of adding navigation.

- [ ] **Step 3: Replace legacy friend-rating fetch usage**

Wire movie followed ratings to `get_followed_title_ratings` and each selected season to one `get_followed_episode_ratings` query. Pass keyed episode arrays into `SeasonSection`; remove any per-episode or client-side fan-out.

- [ ] **Step 4: Integrate Reviews before mobile recommendations**

Place `ReviewsSection` in the mobile title screen immediately before its recommendation/related-title section while preserving community statistics and personal controls.

- [ ] **Step 5: Verify mobile package**

```powershell
pnpm --filter @kino/mobile typecheck
pnpm --filter @kino/mobile lint
```

Expected: both pass, or if the package has no lint script the recursive root lint reports it as skipped.

- [ ] **Step 6: Commit mobile UI**

```powershell
git add apps/mobile
git commit -m "feat(mobile): add reviews and grouped social ratings"
```

### Task 6: Documentation, regression checks, and production verification

**Files:**
- Create: `docs/REVIEWS.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-27-title-reviews-and-followed-ratings-design.md`

**Interfaces:**
- Consumes: all implemented RPCs, services, hooks, components, and commands.
- Produces: migration/runbook documentation and final verification evidence.

- [ ] **Step 1: Amend the design record**

Record the approved half-star domain, `(user_id, title_id)` review uniqueness, canonical latest-rating snapshot, actual `follows` identifiers, and the decision to retain rewatch rows.

- [ ] **Step 2: Write deployment and API documentation**

Document:

```text
1. Back up staging.
2. Apply database/migrations/2026-07-27-add-reviews-and-halfstar-ratings.sql.
3. Run database/tests/reviews_and_halfstar_ratings.sql.
4. Deploy core/web/mobile clients only after RPC verification.
```

Include RPC signatures, permission model, cursor example, snapshot semantics, rollback considerations, component locations, test commands, and the acceptance checklist.

- [ ] **Step 3: Run repository tests in parallel where independent**

```powershell
pnpm typecheck
pnpm lint
pnpm --filter @kino/core test
pnpm --filter @kino/web test
```

Expected: all configured checks pass.

- [ ] **Step 4: Run production build**

```powershell
pnpm build
```

Expected: Next.js production build and OG bundle checks pass.

- [ ] **Step 5: Run targeted static and accessibility checks**

Search for raw keys, `dangerouslySetInnerHTML`, stale follow-table names, missing `aria-pressed`, and reviews placed after More Like This. Start the web app and inspect movie/series pages at 320 px and desktop when usable seeded data and Supabase configuration exist.

- [ ] **Step 6: Review the complete diff**

```powershell
git diff --check
git status --short
git log --oneline -8
```

Ensure unrelated pre-existing authentication changes remain untouched.

- [ ] **Step 7: Commit documentation**

```powershell
git add docs/REVIEWS.md README.md docs/superpowers/specs/2026-07-27-title-reviews-and-followed-ratings-design.md docs/superpowers/plans/2026-07-27-title-reviews-and-half-star-ratings.md
git commit -m "docs: add reviews rollout guide"
```
