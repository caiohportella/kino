# Lifetime Recap Story Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task with review checkpoints.

**Goal:** Make the lifetime recap image use the monthly recap’s shared data semantics and story presentation while adding localized Kino Time and lifetime-specific ranked content.

**Architecture:** Extract the reusable activity summary from \`packages/core/src/profile-stats.ts\`; keep monthly-only date/comparison fields in \`buildProfileMonthlyRecap()\` and add \`buildProfileLifetimeRecap()\` for lifetime-wide data. Extract the common OG story primitives into \`apps/web/lib/profile-recap-story.ts\`, then make both recap routes compose those primitives.

**Tech Stack:** TypeScript, \`@kino/core\`, Supabase, Next.js \`ImageResponse\`, React \`createElement\`, Tolgee/i18n JSON resources, Node test runner, Biome.

## Global Constraints

- Preserve \`getProfileLifetimeStatsByProfileId\`, \`getProfileLifetimeStatsFromTables\`, \`get_profile_lifetime_stats\`, and \`ProfileLifetimeStats\` semantics and fallback behavior.
- Do not filter lifetime \`episode_ratings\` to non-null ratings; filter nulls only inside rating calculations.
- Use \`localeRegion(language) ?? 'US'\` for all TMDb localized-title batches.
- Keep all story images at exactly 1080×1920.
- Preserve unrelated pre-existing worktree changes and leave the new design spec uncommitted. Implementation task commits are confined to the isolated branch created for this workflow.
- Use TDD: write and run a failing test before each production behavior change.

---

### Task 1: Add lifetime recap types and the shared-summary test contract

**Files:**
- Modify: \`packages/core/src/types.ts:446-625\`
- Modify: \`packages/core/src/profile-stats.test.mjs\`

**Interfaces:**
- Produces \`ProfileLifetimeRecap\` with lifetime totals, \`topRatedMovies\`, \`topRatedSeries\`, \`topGenres\`, \`mostRatedGenre\`, and the five highest-rated category fields.
- Adds the optional \`watchedEpisodeCount\` field needed only by lifetime series pills to the reused title shape.

- [ ] **Step 1: Write failing core tests for lifetime output shape and semantics**

Add tests beside the existing \`buildProfileMonthlyRecap\` tests:

\`\`\`js
test('lifetime recap preserves repeated movie diary watches and series episode counts', async () => {
  const { buildProfileLifetimeRecap } = await import('@kino/core')

  const recap = buildProfileLifetimeRecap({
    lifetime: { moviesWatched: 2, episodesWatched: 2, ratingsMade: 1, timeWatchedMinutes: 300 },
    diaryRows: [movieDiary('m1', '2026-01-01'), movieDiary('m1', '2026-01-02')],
    movieRatingRows: [movieRating('m1', 5)],
    episodeRatingRows: [episodeRow('s1', null), episodeRow('s1', 4)],
    watchedSeries: [watchedSeries('s1', 47)],
  })

  assert.equal(recap.moviesWatched, 2)
  assert.equal(recap.topRatedMovies[0].count, 2)
  assert.equal(recap.topRatedSeries[0].watchedEpisodeCount, 47)
  assert.equal(recap.topRatedSeries[0].rating, 4)
})
\`\`\`

Define local fixture factories in \`packages/core/src/profile-stats.test.mjs\` following its existing fixture conventions; keep the null episode rating row in the input so the test proves it contributes to activity metadata without inflating the rating calculation.

- [ ] **Step 2: Run the focused test and verify the expected missing-builder failure**

Run:

\`\`\`bash
pnpm --filter @kino/core test -- --test-name-pattern="lifetime recap preserves"
\`\`\`

Expected: FAIL because \`buildProfileLifetimeRecap\` and \`ProfileLifetimeRecap\` do not yet exist.

- [ ] **Step 3: Add the minimal type definitions**

Define \`ProfileLifetimeRecap\` by reusing \`ProfileMonthlyRecapTitle\`, \`ProfileGenreStat\`, \`ProfileRatedCategoryStat\`, and \`ProfileRatedDecadeStat\`. Add \`mostRatedGenre\` because the final lifetime story retains the “most rated genre” tile. Add \`watchedEpisodeCount?: number\` to \`ProfileMonthlyRecapTitle\` rather than creating a duplicate lifetime title type.

- [ ] **Step 4: Run the focused test again and confirm it now fails only on the missing implementation**

Run the same command. Expected: the type import resolves, but the test still fails because the builder is not implemented.

---

### Task 2: Extract the shared activity summarizer and build lifetime recaps

**Files:**
- Modify: \`packages/core/src/profile-stats.ts:915-1710\`
- Modify: \`packages/core/src/profile-stats.test.mjs\`

**Interfaces:**
- Produces \`summarizeProfileActivity({ diaryRows, movieRatingRows, episodeRatingRows, watchedSeries, monthRange? })\` internally.
- Produces \`buildProfileLifetimeRecap(input): ProfileLifetimeRecap\`.
- Keeps \`buildProfileMonthlyRecap(input): ProfileMonthlyRecap\` externally compatible.

- [ ] **Step 1: Add a failing regression test for monthly/lifetime ranking parity and runner-up source data**

\`\`\`js
test('lifetime and monthly use the same top-rated title ordering for the same unbounded activity', async () => {
  const { buildProfileMonthlyRecap, buildProfileLifetimeRecap } = await import('@kino/core')
  const rows = makeSharedRecapRows()

  const lifetime = buildProfileLifetimeRecap({
    lifetime: { moviesWatched: 3, episodesWatched: 0, ratingsMade: 3, timeWatchedMinutes: 360 },
    ...rows,
    watchedSeries: [],
  })
  const monthly = buildProfileMonthlyRecap({
    year: 2026,
    month: 1,
    current: { ...rows, watchedSeries: [] },
    previous: { diaryRows: [], movieRatingRows: [], episodeRatingRows: [] },
  })

  assert.deepEqual(
    lifetime.topRatedMovies.map((item) => item.titleId),
    monthly.topRatedMovies.map((item) => item.titleId),
  )
})
\`\`\`

- [ ] **Step 2: Run the focused core tests and confirm the expected missing-builder failure**

Run:

\`\`\`bash
pnpm --filter @kino/core test -- --test-name-pattern="lifetime and monthly use"
\`\`\`

Expected: FAIL because the lifetime builder is absent.

- [ ] **Step 3: Extract \`summarizeMonth\` into \`summarizeProfileActivity\` without changing its algorithms**

Move the current maps, rating aggregation, diary/episode loops, series metadata, highlight calculations, and finished-series calculation into the new helper. Replace direct month-range checks with a small \`isWithinRange(watchedAt, monthRange)\` guard that returns true when \`monthRange\` is absent. Keep date keys, rating normalization, tie-breakers, and \`calculateRatedHighlights(..., 2)\` unchanged.

- [ ] **Step 4: Make \`buildProfileMonthlyRecap\` call the extracted helper**

Call the helper once for current data with the current range and once for previous data with the previous range. Preserve every existing monthly return field and previous-month delta calculation. Do not add lifetime totals or lifetime metadata to the monthly return type.

- [ ] **Step 5: Implement \`buildProfileLifetimeRecap\` on the shared summary**

Call the helper without a date range. Use the supplied lightweight \`lifetime\` object for the four canonical totals. Derive top-rated arrays using the same \`titleById\` sort definitions as monthly, keep up to ten entries, and enrich TV items from \`watchedSeries\` by setting \`watchedEpisodeCount\` from \`watched_episode_count\`. Return \`mostRatedGenre\` from \`summary.ratedHighlights.mostRatedGenre\`.

- [ ] **Step 6: Run the focused core tests and the full core suite**

Run:

\`\`\`bash
pnpm --filter @kino/core test -- --test-name-pattern="lifetime|monthly"
pnpm --filter @kino/core test
\`\`\`

Expected: all focused and existing core tests pass, including the pre-existing monthly aggregation tests.

---

### Task 3: Add the dedicated database lifetime recap path

**Files:**
- Modify: \`packages/core/src/database.ts:40-55, 1154-1315\`
- Modify: \`apps/web/lib/profile-query-service.ts:1-245\`
- Modify: \`apps/web/lib/profile-query-options.ts:1-70, 380-425\`
- Modify: \`apps/web/lib/profile-query-service.test.mjs\`
- Modify: \`apps/web/lib/profile-query-options.test.mjs\`

**Interfaces:**
- Adds \`KinoDatabaseService.getProfileLifetimeRecapByProfileId(profileId): Promise<ProfileLifetimeRecap>\`.
- Adds the same optional method to \`LegacyProfileDatabase\`, \`CanonicalProfileMethods\`, and \`ProfileQueryService\`.
- Adds an empty \`ProfileLifetimeRecap\` adapter fallback when a legacy database lacks the method.

- [ ] **Step 1: Write a failing service-contract test**

\`\`\`js
test('delegates lifetime recap to the dedicated database method', async () => {
  let calledWith = null
  const service = createProfileQueryService({
    getUserProfile: async () => ({ username: 'caio' }),
    getProfileReviews: async () => ({ items: [], nextCursor: null, totalCount: 0 }),
    getPublicProfileStatsByUsername: async () => null,
    getProfileLifetimeStatsByProfileId: async () => emptyLifetimeStats(),
    getProfileLifetimeRecapByProfileId: async (profileId) => {
      calledWith = profileId
      return emptyLifetimeRecap()
    },
  })

  await service.getProfileLifetimeRecapByProfileId('profile-1')
  assert.equal(calledWith, 'profile-1')
})
\`\`\`

- [ ] **Step 2: Run the focused web service test and confirm the missing-method failure**

Run:

\`\`\`bash
pnpm --filter @kino/web test -- --test-name-pattern="dedicated database method"
\`\`\`

Expected: FAIL because the adapter contract does not expose the new method.

- [ ] **Step 3: Add the database query using the exact monthly-equivalent select clauses**

Implement \`getProfileLifetimeRecapByProfileId\` immediately after the existing lightweight lifetime method. Run the five requests in \`Promise.all\`, leave \`episode_ratings\` unfiltered, throw on query errors, call \`buildProfileLifetimeRecap\`, and return its safe empty structure from the catch block with the required log message.

- [ ] **Step 4: Add the web adapter contract and empty fallback**

Bind and delegate the method in \`createProfileQueryService\`. Its fallback returns zero totals, empty ranked/genre arrays, and null highlight fields. Do not change the existing lifetime stats fallback.

- [ ] **Step 5: Run focused service tests and core/web typechecks**

Run:

\`\`\`bash
pnpm --filter @kino/web test -- --test-name-pattern="lifetime recap"
pnpm --filter @kino/core typecheck
pnpm --filter @kino/web typecheck
\`\`\`

Expected: the new delegation test and existing service tests pass; both packages typecheck successfully.

---

### Task 4: Extract and adopt shared OG story primitives

**Files:**
- Create: \`apps/web/lib/profile-recap-story.ts\`
- Modify: \`apps/web/app/api/[username]/stats/recap/[year]/[month]/route.ts:1-1250\`
- Modify: \`apps/web/lib/profile-lifetime-recap-route.test.mjs\`

**Interfaces:**
- Shared exports include \`StoryTopBar\`, \`StoryHeader\`, \`StoryStatsOverview\`, \`StorySummaryStatTile\`, \`StoryFeaturedSection\`, \`StoryRankedSections\`, \`StoryStatTile\`, and \`StoryFooter\`.
- Components accept plain localized strings and already-preloaded safe image data; they do not fetch data or call translation services.

- [ ] **Step 1: Add a failing source regression test for monthly rank semantics**

\`\`\`js
test('monthly story assigns series runner-up ranks starting at two', async () => {
  const route = await readFile(new URL('../app/api/[username]/stats/recap/[year]/[month]/route.ts', import.meta.url), 'utf8')
  assert.match(route, /seriesRunnersUp[\\s\\S]*index \\+ 2/)
  assert.doesNotMatch(route, /seriesRunnersUp[\\s\\S]*index \\+ 1/)
})
\`\`\`

- [ ] **Step 2: Run the source test and confirm it fails on the existing \`index + 1\` implementation**

Run:

\`\`\`bash
pnpm --filter @kino/web test -- --test-name-pattern="series runner-up ranks"
\`\`\`

Expected: FAIL because the monthly route currently starts series runner-ups at rank 1.

- [ ] **Step 3: Move the monthly shared component functions into the story module**

Move only the common component implementations and their shared style constants. Keep monthly-specific label types, data selection, localization, and \`StatsGrid\` behavior in the monthly route. Add the summary-tile \`subtitle\` prop and a \`kind\`/ \`valueSize\` prop for text versus numeric content without changing dimensions, padding, radius, border, or background.

- [ ] **Step 4: Recompose the monthly route with the shared primitives**

Import the new components, remove their route-local duplicates, and keep the monthly output visually equivalent. Change only \`seriesRunnersUp\` to \`index + 2\`; preserve the existing movie filtering behavior and featured selection.

- [ ] **Step 5: Run route source tests and monthly-focused tests**

Run:

\`\`\`bash
pnpm --filter @kino/web test -- --test-name-pattern="monthly story|runner-up|recap route"
pnpm --filter @kino/web lint
\`\`\`

Expected: tests pass and Biome/lint reports no modified-file errors.

---

### Task 5: Rebuild the lifetime route on the shared story composition

**Files:**
- Modify: \`apps/web/app/api/[username]/stats/recap/lifetime/route.ts:1-760\`
- Modify: \`apps/web/lib/profile-lifetime-recap-route.test.mjs\`

**Interfaces:**
- The route calls \`getProfileLifetimeRecapByProfileId\` and receives \`ProfileLifetimeRecap\`.
- The route-local formatter produces a localized Kino Time string and member-since subtitle without hardcoded language branches.

- [ ] **Step 1: Add failing route contract tests for the requested lifetime composition**

Add assertions for:

\`\`\`js
assert.match(route, /getProfileLifetimeRecapByProfileId/)
assert.match(route, /created_at/)
assert.match(route, /sinceBeginning/)
assert.match(route, /lifetimeHeadline/)
assert.match(route, /kinoTimeYears|kinoTimeMonths|kinoTimeDays/)
assert.match(route, /movieRunnersUp[\\s\\S]*index \\+ 2/)
assert.match(route, /seriesRunnersUp[\\s\\S]*index \\+ 2/)
assert.doesNotMatch(route, /StatsPills/)
assert.doesNotMatch(route, /toFixed\\(1\\).*\\/ 5/)
\`\`\`

- [ ] **Step 2: Run the route tests and verify they fail against the old implementation**

Run:

\`\`\`bash
pnpm --filter @kino/web test -- --test-name-pattern="lifetime recap"
\`\`\`

Expected: FAIL on the dedicated query, \`created_at\`, and removed presentation markers.

- [ ] **Step 3: Update the profile query and route data loading**

Select \`id,username,display_name,created_at\`. Replace the three old lifetime data calls with the dedicated recap call. Keep the route’s existing reserved-route, language, font, response-header, and 1080×1920 behavior.

- [ ] **Step 4: Localize all displayed lifetime title items and preload all displayed posters**

Batch \`topRatedMovies\` and \`topRatedSeries\`, then map localized values back into the recap arrays. Derive featured items and \`slice(1, 4)\` runners-up after localization. Preload the featured and runner-up title IDs through the same safe image helper used monthly. Use the localized poster path when available.

- [ ] **Step 5: Implement localized Kino Time and member-since values**

Calculate elapsed calendar duration from \`created_at\` to \`new Date()\`. Use years when at least one full year has elapsed, months when at least one full month has elapsed, otherwise days with a minimum of zero. Pass the count through \`t('stats.story.kinoTimeYears', { count })\`, \`kinoTimeMonths\`, or \`kinoTimeDays\`; pass \`createdYear\` through \`t('stats.story.memberSince', { year: createdYear })\`.

- [ ] **Step 6: Compose the lifetime story with shared primitives**

Render the monthly hierarchy and dimensions: shared top bar, \`sinceBeginning\` eyebrow, personalized \`lifetimeHeadline\`, watch-time hero, four summary tiles, one shared featured section, ranked movie/series runner-up lists, six \`StoryStatTile\`s, and the shared footer. Use pill copy for rating, movie diary watch count, and series \`watchedEpisodeCount\`. Render null/empty values as the existing safe em dash.

- [ ] **Step 7: Run the lifetime route tests and typecheck**

Run:

\`\`\`bash
pnpm --filter @kino/web test -- --test-name-pattern="lifetime recap"
pnpm --filter @kino/web typecheck
\`\`\`

Expected: all lifetime route contract tests pass and the web package typechecks.

---

### Task 6: Add all lifetime story translations and localization coverage

**Files:**
- Modify: \`locales/en/translation.json\`
- Modify: \`locales/pt/translation.json\`
- Modify: \`locales/fr/translation.json\`
- Modify: \`locales/it/translation.json\`
- Modify: \`locales/no/translation.json\`
- Modify: \`apps/web/lib/profile-lifetime-i18n.test.mjs\`

**Interfaces:**
- Adds all lifetime story keys under \`stats.story\` in every supported locale.
- Pluralized keys expose both \`_one\` and \`_other\` forms with \`{{count}}\`.

- [ ] **Step 1: Add failing translation tests for the new key set**

Extend the locale test’s required keys with:

\`\`\`js
const requiredStoryKeys = [
  'sinceBeginning',
  'lifetimeHeadline',
  'kinoTime',
  'memberSince',
  'kinoTimeDays_one',
  'kinoTimeDays_other',
  'kinoTimeMonths_one',
  'kinoTimeMonths_other',
  'kinoTimeYears_one',
  'kinoTimeYears_other',
]
\`\`\`

- [ ] **Step 2: Run the locale test and confirm missing-key failures**

Run:

\`\`\`bash
pnpm --filter @kino/web test -- --test-name-pattern="lifetime.*translation|Lifetime.*translation"
\`\`\`

Expected: FAIL for each locale until the resources are added.

- [ ] **Step 3: Add natural translations in all five locale files**

Use the existing locale style and preserve interpolation names. The English and Portuguese values must express “Since the beginning”, “The journey of {{name}} on Kino”, localized Kino Time units, and “Member since {{year}}”; the other locales must provide equivalent localized wording rather than English fallbacks.

- [ ] **Step 4: Run the locale tests and inspect plural interpolation**

Run the same focused test command. Expected: PASS for every supported locale, with \`_one\` and \`_other\` forms present and no direct \`pt\`/\`en\` conditionals in the route formatter.

---

### Task 7: Verify code quality and both generated story images

**Files:**
- No new source files; inspect the complete diff and generated artifacts only.

- [ ] **Step 1: Run focused core and web tests**

\`\`\`bash
pnpm --filter @kino/core test
pnpm --filter @kino/web test -- --test-name-pattern="recap|lifetime|story|localization"
\`\`\`

Expected: exit code 0 with no test failures.

- [ ] **Step 2: Run TypeScript and modified-scope Biome checks**

\`\`\`bash
pnpm --filter @kino/core typecheck
pnpm --filter @kino/web typecheck
pnpm exec biome check packages/core/src/types.ts packages/core/src/profile-stats.ts packages/core/src/database.ts apps/web/app/api/[username]/stats/recap/[year]/[month]/route.ts apps/web/app/api/[username]/stats/recap/lifetime/route.ts apps/web/lib/profile-recap-story.ts apps/web/lib/profile-query-service.ts apps/web/lib/profile-query-options.ts locales/en/translation.json locales/pt/translation.json locales/fr/translation.json locales/it/translation.json locales/no/translation.json
pnpm --filter @kino/web lint
\`\`\`

Expected: all commands exit 0. If a formatter changes files, review the diff and rerun the check rather than touching unrelated files.

- [ ] **Step 3: Generate monthly and lifetime images locally**

Start the existing web dev server with the repository’s normal environment, request one valid monthly URL and the matching lifetime URL, and save both 1080×1920 responses under a temporary directory outside the repository. Use the same profile and locale for both requests so title/localization comparisons are meaningful.

- [ ] **Step 4: Inspect both images side-by-side**

Verify the header hierarchy, logo scale, hero card, identical 2×2 tile geometry, one shared featured container, rank-2 runners-up, six lower stat tiles, no duplicate \`AVALIAÇÕES\`, no overflow, and localized Kino Time/member-since values. Confirm no title appears as both featured and runner-up.

- [ ] **Step 5: Run the final web build and review the diff**

\`\`\`bash
pnpm build:web
git diff --check
git status --short
\`\`\`

Expected: the build and whitespace check pass; the final status contains only the intended recap/spec/plan files plus the user’s pre-existing changes, with no commit created.
