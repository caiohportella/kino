# Review Profile Identity and Profile Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make review UI consistently use Kino profile identity, add accessible direct author controls, add a paginated Reviews row to web profiles, and add authoritative review counts to profile Open Graph images.

**Architecture:** Normalize review authors in `@kino/core`, then use the authenticated `user_profiles` record for every optimistic review on web and mobile. Add one grouped, cursor-paginated profile-review RPC that returns author, title, and like data without N+1 requests; render it through reusable web review primitives. Extend the existing public-profile OG RPC with a review count and keep current bounded HTTP caching.

**Tech Stack:** PostgreSQL/Supabase RPC and RLS, TypeScript, React 19, Next.js 15, React Query 5, Base UI/shadcn primitives, Expo/React Native, Tailwind CSS, Node test runner, Biome.

## Global Constraints

- Preserve the existing review schema, one-review constraint, permissions, title-page placement, like behavior, privacy rules, title routes, and React Query architecture.
- Identity corrections apply to web and mobile review surfaces; the Profile Reviews row and OG work are web-only.
- Never construct review UI identity from OAuth or `user_metadata`.
- Visible author labels use trimmed Kino `displayName`, then Kino `username`; routes always use normalized username.
- Title-page review text stays complete; only profile previews are clamped.
- Profile reviews order by `created_at DESC, id DESC`; edits never move a review.
- Profile review data must join title metadata and authoritative like counts in one query.
- Do not disable profile OG caching globally.
- All user-facing copy must be localized with correct pluralization.

---

### Task 1: Normalize Kino Review Authors in Core

**Files:**
- Modify: `packages/core/src/reviews.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/reviews.test.mjs`

**Interfaces:**
- Consumes: `UserProfile` from `packages/core/src/types.ts`.
- Produces:
  - `type KinoReviewAuthor = PublicUserSummary`
  - `toReviewAuthor(profile: Pick<UserProfile, "id" | "username" | "display_name" | "avatar_url">): KinoReviewAuthor`
  - `getReviewAuthorLabel(author: Pick<KinoReviewAuthor, "displayName" | "username">): string | null`

- [ ] **Step 1: Write failing author-normalization tests**

Add cases to `reviews.test.mjs` proving that whitespace-only display names fall back to username and snake-case Kino profile fields map to the public author shape:

```js
test('toReviewAuthor maps only Kino profile identity', () => {
  assert.deepEqual(
    toReviewAuthor({
      id: 'user-1',
      username: 'dex',
      display_name: 'Dex Kino',
      avatar_url: 'https://kino.test/dex.png',
    }),
    {
      id: 'user-1',
      username: 'dex',
      displayName: 'Dex Kino',
      avatarUrl: 'https://kino.test/dex.png',
    }
  )
})

test('getReviewAuthorLabel uses a trimmed Kino display name then username', () => {
  assert.equal(getReviewAuthorLabel({ displayName: '  Dex Kino  ', username: 'dex' }), 'Dex Kino')
  assert.equal(getReviewAuthorLabel({ displayName: '   ', username: 'dex' }), 'dex')
  assert.equal(getReviewAuthorLabel({ displayName: null, username: null }), null)
})
```

- [ ] **Step 2: Run the core review tests and verify failure**

Run: `pnpm --filter @kino/core test`

Expected: FAIL because the two helpers are not exported.

- [ ] **Step 3: Implement and export the shared adapter**

Add to `reviews.ts`:

```ts
export type KinoReviewAuthor = PublicUserSummary

export function toReviewAuthor(
  profile: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>
): KinoReviewAuthor {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  }
}

export function getReviewAuthorLabel(
  author: Pick<KinoReviewAuthor, 'displayName' | 'username'>
) {
  return author.displayName?.trim() || author.username || null
}
```

Import `UserProfile` as a type and ensure `packages/core/src/index.ts` re-exports the helpers.

- [ ] **Step 4: Run core tests and type-check**

Run:

```powershell
pnpm --filter @kino/core test
pnpm --filter @kino/core typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/core/src/reviews.ts packages/core/src/reviews.test.mjs packages/core/src/index.ts
git commit -m "feat(core): normalize Kino review authors"
```

---

### Task 2: Remove OAuth Identity from Optimistic Reviews

**Files:**
- Modify: `apps/web/app/title/[id]/page.tsx`
- Modify: `apps/web/hooks/use-title-reviews.ts`
- Modify: `apps/mobile/app/title/[id].tsx`
- Modify: `apps/mobile/hooks/data/useTitleReviews.ts`
- Create: `apps/web/lib/review-identity.test.mjs`
- Create: `apps/mobile/utils/reviewIdentity.test.mjs`

**Interfaces:**
- Consumes: `toReviewAuthor`, `KinoReviewAuthor`, `db.getUserProfile(userId)`, and the mobile `useDatabase` profile query.
- Produces: optimistic create variables whose `author` always comes from Kino `user_profiles`.

- [ ] **Step 1: Add identity-source regression tests**

Create source-level regression tests that read the two title screens and assert review-author construction contains `toReviewAuthor` and does not contain these provider patterns:

```js
for (const forbidden of [
  'user_metadata.avatar_url',
  'user_metadata.full_name',
  'user_metadata.display_name',
  'session.user.image',
]) {
  assert.equal(source.includes(forbidden), false, `must not use ${forbidden}`)
}
assert.match(source, /toReviewAuthor\s*\(/)
```

The web test reads `app/title/[id]/page.tsx`; the mobile test reads `app/title/[id].tsx`.

- [ ] **Step 2: Run the new tests and verify failure**

Run:

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/mobile test
```

Expected: FAIL because both title screens still reference `user_metadata`.

- [ ] **Step 3: Load the current Kino profile and adapt it**

On web, add a query keyed as `['current-kino-profile', user?.id]`:

```ts
const currentProfile = useQuery({
  queryKey: ['current-kino-profile', user?.id],
  queryFn: () => db.getUserProfile(user!.id),
  enabled: Boolean(user?.id),
})
const reviewAuthor = currentProfile.data ? toReviewAuthor(currentProfile.data) : null
```

Use the existing mobile database/profile hook to obtain the same `UserProfile`, then call `toReviewAuthor`. Do not introduce another Supabase client or provider-metadata fallback.

Pass `reviewAuthor` to the review section. While authenticated and the profile query is pending, render the existing review skeleton. If it fails, render the localized section error/retry state and keep publishing disabled.

- [ ] **Step 4: Keep optimistic mutations structurally consistent**

Change both hooks to accept `author: KinoReviewAuthor`. Preserve text and rollback behavior. On success, remove the optimistic ID before inserting the authoritative response on mobile as web already does, preventing duplicate optimistic/live cards:

```ts
const withoutOptimistic = page
  ? {
      ...page,
      items: page.items.filter((item) => !item.id.startsWith('optimistic:')),
      totalCount: Math.max(0, page.totalCount - 1),
    }
  : page
return insertViewerReview(withoutOptimistic, review)
```

- [ ] **Step 5: Run identity tests and platform type-checks**

Run:

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/mobile test
pnpm --filter @kino/web typecheck
pnpm --filter @kino/mobile typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/app/title/[id]/page.tsx apps/web/hooks/use-title-reviews.ts apps/web/lib/review-identity.test.mjs apps/mobile/app/title/[id].tsx apps/mobile/hooks/data/useTitleReviews.ts apps/mobile/utils/reviewIdentity.test.mjs
git commit -m "fix(reviews): use Kino identity for optimistic authors"
```

---

### Task 3: Add Grouped Profile Review Database API

**Files:**
- Create: `database/migrations/2026-07-27-add-profile-reviews.sql`
- Modify: `packages/core/src/reviews.ts`
- Modify: `packages/core/src/database.ts`
- Modify: `packages/core/src/reviews.test.mjs`
- Create: `database/tests/profile_reviews.sql`

**Interfaces:**
- Consumes: existing `reviews`, `review_likes`, `titles`, `user_profiles`, block/privacy helpers, and `mapReviewRow`.
- Produces:

```ts
type ProfileReviewTitle = {
  id: string
  tmdbId: number
  mediaType: MediaType
  name: string
  slug: string
  year: number | null
  posterUrl: string | null
}

type ProfileReview = Review & { title: ProfileReviewTitle }
type ProfileReviewsPage = {
  items: ProfileReview[]
  nextCursor: { created_at: string; id: string } | null
  totalCount: number
}

getProfileReviews(
  username: string,
  options?: { limit?: number; cursor?: ProfileReviewCursor | null }
): Promise<ProfileReviewsPage>
```

- [ ] **Step 1: Write SQL contract tests**

Create transaction-wrapped pgTAP/plain SQL assertions covering:

- latest-created review is first;
- editing `updated_at` does not change order;
- page limit plus cursor returns the next unique rows;
- title fields are present without additional queries;
- like count is authoritative;
- viewer-like state is true only for the authenticated viewer;
- deleted/unavailable profiles and blocked/private rows follow existing visibility rules.

Use fixtures with two users, three titles, four reviews, and two likes. Roll back the transaction.

- [ ] **Step 2: Write failing core mapping tests**

Add a `ProfileReviewRow` fixture and assert:

```js
assert.deepEqual(page.items[0].title, {
  id: 'title-1',
  tmdbId: 238,
  mediaType: 'movie',
  name: 'The Godfather',
  slug: 'the-godfather',
  year: 1972,
  posterUrl: '/poster.jpg',
})
assert.deepEqual(page.nextCursor, { created_at: '2026-07-26T12:00:00Z', id: 'review-2' })
assert.equal(page.totalCount, 4)
```

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm --filter @kino/core test`

Expected: FAIL because the profile-review mapper is absent.

- [ ] **Step 4: Implement the SQL function**

Create a `security invoker`, stable SQL function with arguments:

```sql
get_profile_reviews(
  profile_username text,
  page_limit integer default 6,
  cursor_created_at timestamptz default null,
  cursor_id uuid default null
)
```

Resolve the profile once, join title and author data, aggregate likes in a lateral/grouped subquery, and use:

```sql
where (cursor_created_at is null or (r.created_at, r.id) < (cursor_created_at, cursor_id))
order by r.created_at desc, r.id desc
limit least(greatest(page_limit, 1), 50) + 1
```

Return `count(*) over ()` from the unpaginated visible set as `total_count`. Revoke public mutation access and grant execute consistently with existing public read RPCs.

- [ ] **Step 5: Implement TypeScript mapping and service method**

Add `ProfileReviewRow`, `ProfileReviewCursor`, `ProfileReview`, `ProfileReviewsPage`, `mapProfileReviewsPage`, and:

```ts
async getProfileReviews(
  username: string,
  { limit = 6, cursor = null }: ProfileReviewOptions = {}
) {
  const { data, error } = await this.supabase.rpc('get_profile_reviews', {
    profile_username: username,
    page_limit: limit,
    cursor_created_at: cursor?.created_at ?? null,
    cursor_id: cursor?.id ?? null,
  })
  if (error) throw error
  return mapProfileReviewsPage(data ?? [], limit)
}
```

- [ ] **Step 6: Run migration/API tests**

Run:

```powershell
pnpm --filter @kino/core test
pnpm --filter @kino/core typecheck
pnpm exec supabase db reset
```

Then execute `database/tests/profile_reviews.sql` with the repository's local Supabase test command or SQL runner.

Expected: migration succeeds; SQL assertions and core tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add database/migrations/2026-07-27-add-profile-reviews.sql database/tests/profile_reviews.sql packages/core/src/reviews.ts packages/core/src/reviews.test.mjs packages/core/src/database.ts
git commit -m "feat(reviews): add grouped profile review query"
```

---

### Task 4: Refine Shared Web Review Identity and Owner Controls

**Files:**
- Modify: `apps/web/components/reviews/review-author.tsx`
- Modify: `apps/web/components/reviews/review-card.tsx`
- Modify: `apps/web/components/reviews/review-composer.tsx`
- Create: `apps/web/components/reviews/review-owner-actions.tsx`
- Create: `apps/web/lib/review-card-contract.test.mjs`

**Interfaces:**
- Consumes: `getReviewAuthorLabel`, `normalizeProfileUsername`, existing `RatingStars`, `Tooltip`, `Button`, `ReviewEditor`, and delete dialog.
- Produces:
  - `ReviewAuthorLink` for avatar/name identity;
  - `ReviewOwnerActions` direct Pencil/Trash controls;
  - title-page `ReviewCard` with full text and no overflow menu.

- [ ] **Step 1: Write failing component contract tests**

Read rendered component source and assert:

- no `DropdownMenu` or `MoreHorizontal`;
- Pencil and Trash buttons have translated `aria-label`;
- author name and avatar both use a canonical username link;
- `RatingStars` uses review-specific small size;
- title-page content retains `whitespace-pre-wrap` and does not use `line-clamp`.

- [ ] **Step 2: Run web tests and verify failure**

Run: `pnpm --filter @kino/web test`

Expected: FAIL on the current overflow menu and plain author name.

- [ ] **Step 3: Centralize author label and profile href**

Refactor `ReviewAuthor` to render link or non-link variants. Generate the route only when `normalizeProfileUsername(author.username)` succeeds. Add event handling:

```tsx
onClick={(event) => event.stopPropagation()}
```

Use `getReviewAuthorLabel(author) ?? t('reviews.user')` for visible labels and Avatar fallback initials.

- [ ] **Step 4: Add direct owner icon actions**

Implement `ReviewOwnerActions` with two adjacent ghost icon buttons. Wrap each in the existing Tooltip component, retain `aria-label`, stop propagation, and apply destructive classes to Delete. Keep the confirmation dialog owned by `ReviewCard`.

- [ ] **Step 5: Update composer and review header**

Make the author name a separate canonical profile link after `Reviewed by`. Keep stars read-only and use the smallest existing review-appropriate size/class without changing `RatingStars` defaults. Ensure the accessible label resolves to localized “{rating} out of 5 stars”.

- [ ] **Step 6: Run tests, lint, and type-check**

Run:

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/web lint
pnpm --filter @kino/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/components/reviews apps/web/lib/review-card-contract.test.mjs
git commit -m "feat(web): refine review author controls"
```

---

### Task 5: Build Profile Review Cards and Paginated Query Hooks

**Files:**
- Create: `apps/web/hooks/use-profile-reviews.ts`
- Create: `apps/web/components/reviews/profile-review-card.tsx`
- Create: `apps/web/components/reviews/profile-reviews-section.tsx`
- Create: `apps/web/components/reviews/profile-reviews-dialog.tsx`
- Create: `apps/web/components/reviews/profile-review-skeleton.tsx`
- Modify: `apps/web/hooks/use-title-reviews.ts`
- Modify: `packages/core/src/review-cache.ts`
- Modify: `packages/core/src/review-cache.test.mjs`
- Create: `apps/web/lib/profile-review-card.test.mjs`

**Interfaces:**
- Consumes: `db.getProfileReviews`, profile review types, shared author/actions/editor, `titlePath`, Dialog, React Query.
- Produces:
  - `profileReviewKeys = { all, profile(username), page(username, cursor) }`
  - `useProfileReviews(username)`
  - `ProfileReviewsSection`
  - cache helpers that update a review across title and profile pages.

- [ ] **Step 1: Write failing cache and card tests**

Core tests cover replace/remove/like operations on a `ProfileReviewsPage` without changing item order. Web contract tests assert:

- `line-clamp-4` desktop and a narrow-screen clamp override;
- stretched title link uses `titlePath(tmdbId, name, mediaType)`;
- accessible title-link label;
- interactive controls stop propagation;
- no nested anchor structure;
- poster, title, year, author, stars, content, likes, and date are present.

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pnpm --filter @kino/core test
pnpm --filter @kino/web test
```

Expected: FAIL because profile review cache helpers and components do not exist.

- [ ] **Step 3: Implement stable query keys and pagination**

Use:

```ts
export const profileReviewKeys = {
  all: ['profile-reviews'] as const,
  profile: (username: string) => ['profile-reviews', username] as const,
  page: (username: string, cursor: ProfileReviewCursor | null) =>
    ['profile-reviews', username, cursor] as const,
}
```

The overview query fetches six items. The dialog uses `useInfiniteQuery`, `getNextPageParam: page => page.nextCursor`, and a maximum server page size of 20.

- [ ] **Step 4: Implement the profile review card**

Use a semantic `article` with a relatively positioned stretched title link and `z-10` interactive controls. Render the poster at a compact fixed width, title/year above the review identity, and:

```tsx
<p className="line-clamp-5 break-words whitespace-pre-wrap text-sm leading-6 md:line-clamp-4">
  {review.content}
</p>
```

Reuse like and owner mutation behavior. Do not truncate stored content.

- [ ] **Step 5: Implement section, skeleton, and Show all dialog**

Render a two-column desktop/one-column mobile grid. Hide the section only after a successful empty result. During first load, render two review-shaped skeletons. Show the localized action when `totalCount > items.length`; the existing Dialog supplies focus trapping/restoration.

- [ ] **Step 6: Update all affected caches in mutations**

Create helpers to replace/remove/update-like across any `ProfileReviewsPage`. In web title-review mutations:

- snapshot both `reviewKeys.title(titleId)` and `profileReviewKeys.all`;
- optimistically update all matching profile pages;
- restore both snapshots on failure;
- invalidate title reviews plus the author's profile-review prefix after create/edit/delete;
- invalidate `['profile', authorId]` and `['profile-by-username', username]` after create/delete;
- keep editing in place without sorting.

- [ ] **Step 7: Run focused tests and checks**

Run:

```powershell
pnpm --filter @kino/core test
pnpm --filter @kino/web test
pnpm --filter @kino/web lint
pnpm --filter @kino/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add packages/core/src/review-cache.ts packages/core/src/review-cache.test.mjs apps/web/hooks/use-profile-reviews.ts apps/web/hooks/use-title-reviews.ts apps/web/components/reviews/profile-review-card.tsx apps/web/components/reviews/profile-reviews-section.tsx apps/web/components/reviews/profile-reviews-dialog.tsx apps/web/components/reviews/profile-review-skeleton.tsx apps/web/lib/profile-review-card.test.mjs
git commit -m "feat(web): add profile review cards"
```

---

### Task 6: Add the Reviews Row to Public Web Profiles

**Files:**
- Modify: `apps/web/components/profile-view.tsx`
- Modify: `apps/web/components/skeletons/page-skeletons.tsx`
- Create: `apps/web/lib/profile-reviews-section.test.mjs`

**Interfaces:**
- Consumes: `ProfileReviewsSection`, canonical `profile.username`, and existing profile section/dialog styling.
- Produces: web-only public Profile Reviews row in latest-created order.

- [ ] **Step 1: Write failing profile integration tests**

Assert from the profile component contract that:

- `ProfileReviewsSection` receives canonical `profile.username`;
- it appears before public watchlists or at the agreed shelf position without changing existing rows;
- the global empty-state predicate includes `profileReviews.totalCount`;
- no mobile profile file imports the web section.

- [ ] **Step 2: Run the web tests and verify failure**

Run: `pnpm --filter @kino/web test`

Expected: FAIL because the profile page does not render the section.

- [ ] **Step 3: Integrate the profile preview**

Load the preview through `useProfileReviews(profile.username)` only after the profile resolves. Insert:

```tsx
<ProfileReviewsSection
  isOwner={isOwnProfile}
  username={profile.username}
/>
```

Keep profile failure isolation: a review error must not replace the banner or other shelves. Include review presence in the global profile-empty decision.

- [ ] **Step 4: Extend profile loading skeletons**

Add a compact review-row skeleton that matches the eventual poster-plus-text card dimensions without adding a full-page spinner.

- [ ] **Step 5: Run web tests, lint, and type-check**

Run:

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/web lint
pnpm --filter @kino/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/components/profile-view.tsx apps/web/components/skeletons/page-skeletons.tsx apps/web/lib/profile-reviews-section.test.mjs
git commit -m "feat(web): show reviews on public profiles"
```

---

### Task 7: Add Review Count to Profile Open Graph

**Files:**
- Create: `database/migrations/2026-07-27-add-profile-og-review-count.sql`
- Modify: `packages/core/src/database.ts`
- Modify: `apps/web/lib/server-supabase.ts`
- Modify: `apps/web/lib/og.tsx`
- Modify: `apps/web/app/api/og/profile/route.ts`
- Modify: `apps/web/app/api/og/settings/route.ts`
- Create: `apps/web/lib/profile-og-reviews.test.mjs`
- Create: `database/tests/profile_og_review_count.sql`

**Interfaces:**
- Consumes: existing `get_public_profile_og_data`, `PublicProfileOgData`, `ProfileOg`, and current HTTP cache headers.
- Produces: `PublicProfileOgData.reviews: number` and a four-stat OG row.

- [ ] **Step 1: Write failing database and web OG tests**

Database assertions verify count changes on insert/delete and excludes unavailable/deleted rows according to the preserved schema. Web tests assert:

```js
assert.equal(data.reviews, 2)
assert.match(profileOgSource, /\['Reviews', data\.reviews\]/)
assert.match(routeSource, /max-age=300, stale-while-revalidate=3600/)
```

Also assert fallback/demo OG data supplies `reviews: 0`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/core test
```

Expected: FAIL because `reviews` is absent.

- [ ] **Step 3: Replace the public-profile OG RPC safely**

Create a migration using `create or replace function get_public_profile_og_data(...)` with the existing return columns plus `review_count bigint`. Count published reviews for the resolved profile in the same SQL statement. Preserve `security invoker`, grants, banner data, watched counts, and diary count.

- [ ] **Step 4: Map the count with a rollout-safe fallback**

In both core and web server adapters:

```ts
reviews: toSafeCount(data.review_count ?? 0)
```

For the direct fallback query, issue one count-only `reviews` query alongside the profile query with `Promise.all`; do not fetch review rows.

- [ ] **Step 5: Rebalance the OG stat row**

Use four compact items:

```ts
const stats = [
  ['Movies', data.moviesWatched],
  ['Series', data.seriesWatched],
  ['Diary', data.diaryEntries],
  ['Reviews', data.reviews],
] as const
```

Reduce only the inter-stat gap enough to fit four values. Preserve logo, avatar, banner, bio, identity sizes, and 1200×630 output.

- [ ] **Step 6: Run migration and OG tests**

Run:

```powershell
pnpm exec supabase db reset
pnpm --filter @kino/core test
pnpm --filter @kino/web test
pnpm --filter @kino/web check:og-bundles
pnpm --filter @kino/web typecheck
```

Execute `database/tests/profile_og_review_count.sql`.

Expected: all PASS and existing cache-control remains unchanged.

- [ ] **Step 7: Commit**

```powershell
git add database/migrations/2026-07-27-add-profile-og-review-count.sql database/tests/profile_og_review_count.sql packages/core/src/database.ts apps/web/lib/server-supabase.ts apps/web/lib/og.tsx apps/web/app/api/og/profile/route.ts apps/web/app/api/og/settings/route.ts apps/web/lib/profile-og-reviews.test.mjs
git commit -m "feat(og): add profile review count"
```

---

### Task 8: Complete Localization and Accessibility Contracts

**Files:**
- Modify: `apps/web/lib/i18n.ts`
- Modify: `apps/mobile/i18n.ts`
- Modify: `apps/web/lib/reviews-i18n.test.mjs`
- Modify: `apps/web/lib/i18n-plural.test.mjs`
- Create: `apps/web/lib/review-accessibility.test.mjs`

**Interfaces:**
- Consumes: all new review/profile component translation calls.
- Produces: complete supported-locale copy and pluralization with no raw-key fallback.

- [ ] **Step 1: Add failing locale and accessibility tests**

For every locale, require:

```text
reviews.title
reviews.reviewedBy
reviews.edit
reviews.delete
reviews.readFull
reviews.showAll
reviews.noReviews
reviews.latest
reviews.reviewCount
```

Assert singular/plural output for 0, 1, and 2. Component contracts must assert author links, icon labels, star labels, title-link labels, `aria-pressed`, and dialog usage.

- [ ] **Step 2: Run web/mobile tests and verify failure**

Run:

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/mobile test
```

Expected: FAIL for missing profile-review keys.

- [ ] **Step 3: Add translations to every supported locale**

Follow the existing plural syntax rather than concatenating counts. Reuse existing keys where wording is already correct; add profile-specific aliases only when component context requires different copy. Ensure English and Portuguese include natural singular and plural forms.

- [ ] **Step 4: Correct all accessibility contract failures**

Ensure tooltips supplement rather than replace `aria-label`; author and title links have visible focus classes; stars expose numeric values; and profile-card controls stop parent navigation.

- [ ] **Step 5: Run localization and accessibility tests**

Run:

```powershell
pnpm --filter @kino/web test
pnpm --filter @kino/mobile test
pnpm --filter @kino/web lint
pnpm --filter @kino/mobile lint
```

Expected: PASS with no raw translation keys.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/lib/i18n.ts apps/mobile/i18n.ts apps/web/lib/reviews-i18n.test.mjs apps/web/lib/i18n-plural.test.mjs apps/web/lib/review-accessibility.test.mjs
git commit -m "feat(i18n): localize profile reviews"
```

---

### Task 9: Full Regression and Production Verification

**Files:**
- Modify only files required to fix failures caused by Tasks 1–8.
- Update: `docs/superpowers/plans/2026-07-27-review-profile-identity.md` checkbox state as tasks complete.

**Interfaces:**
- Consumes: completed implementation.
- Produces: verified database, core, web, mobile, accessibility, localization, OG, and production-build result.

- [ ] **Step 1: Audit provider metadata and review routing**

Run:

```powershell
rg -n "user_metadata|full_name|avatar_url|session\.user\.(name|image)" apps/web/components/reviews apps/web/hooks/use-title-reviews.ts apps/web/app/title apps/mobile/components/reviews apps/mobile/hooks/data/useTitleReviews.ts apps/mobile/app/title
rg -n "href=.*author|titlePath|normalizeProfileUsername" apps/web/components/reviews
```

Expected: no provider metadata in review UI/optimistic paths; all author and title routes use canonical helpers.

- [ ] **Step 2: Run all database migrations and SQL tests**

Run:

```powershell
pnpm exec supabase db reset
```

Execute both new SQL test files against local Supabase.

Expected: clean migration from an empty database and all assertions PASS.

- [ ] **Step 3: Run package tests**

Run:

```powershell
pnpm --filter @kino/core test
pnpm --filter @kino/web test
pnpm --filter @kino/mobile test
```

Expected: PASS.

- [ ] **Step 4: Run repository lint and type-check**

Run:

```powershell
pnpm lint
pnpm typecheck
```

Expected: PASS. If unrelated pre-existing dirty auth changes fail, record the exact unrelated failure separately and still run targeted checks on every changed file.

- [ ] **Step 5: Run the production build**

Run: `pnpm build`

Expected: Next.js production build and OG bundle check PASS.

- [ ] **Step 6: Perform responsive browser validation**

Start the web app and verify at desktop and mobile viewport sizes:

- Kino identity remains unchanged through create/edit reconciliation;
- linked avatar/name open the profile independently;
- direct Edit/Delete buttons show focus, tooltip, editor, and confirmation;
- profile cards open titles while nested controls remain independent;
- profile preview clamps and Show all displays complete content;
- empty profiles hide Reviews;
- title pages still show full review text and likes work;
- OG output remains balanced at 1200×630.

- [ ] **Step 7: Review the final diff**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Confirm no unrelated auth files were staged or overwritten and every changed production file has a corresponding test or explicit verification.

- [ ] **Step 8: Commit verification-only fixes**

If verification required fixes, stage only those exact files and commit:

```powershell
git commit -m "fix(reviews): address profile review regressions"
```

Do not create an empty commit.

