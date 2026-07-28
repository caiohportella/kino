# Kino Authentication, Localization Cache, and Semantic Search Design

## Status

Approved for implementation planning on 2026-07-28.

## Objective

Improve Kino's reliability across mobile and web by separating authentication
resolution from unauthenticated state, resolving locale-dependent media before
render, centralizing cache and image policies, and routing semantic search
through a trusted server gateway with deterministic shared-core ranking.

The work preserves the existing pnpm monorepo, Supabase authentication
architecture, Expo Router and Next.js routing, React Query usage, TMDB
integration, localization resources, permissions, title routes, caching
strategy, and UI design. It introduces no database migration or unrelated
refactor.

## Repository Findings

The current implementation has four architectural causes behind the reported
behavior:

1. Authentication is represented as nullable `user` plus `loading`. Several
   protected consumers render unauthenticated illustrations from `!user` before
   initial session restoration completes.
2. Mobile language restoration reads AsyncStorage after the root tree renders.
   Title cards render list metadata first and replace it after per-card localized
   detail requests.
3. Locale-sensitive React Query keys are constructed ad hoc and do not
   consistently encode locale, region, authentication scope, pagination, or
   cache schema.
4. Mobile currently instantiates Upstash Vector with public-prefixed
   credentials. Web uses a separate TMDB search path, so the platforms do not
   share intent detection, relationship expansion, or ranking.

The repository uses Node's built-in test runner with TypeScript stripping,
Biome, TypeScript project checks, React Query v5, Supabase, Expo Router, and
Next.js 15. There is no GitHub Actions workflow at the time of this design.

## Architectural Principles

- Define platform-neutral contracts before platform adapters.
- Land testing and CI before production behavior migrations.
- Keep `packages/core` free of React, Expo, Next.js, browser APIs, Supabase
  client creation, provider SDKs, storage APIs, cookies, and environment access.
- Keep credentials and provider clients in trusted server runtimes.
- Maintain one coordinator-owned integration boundary for shared exports,
  manifests, lockfiles, app providers, and shared layouts.
- Use independent commits and verification gates for every category and
  migration batch.
- Keep the existing TMDB search path available as gateway fallback until both
  platform clients are verified.
- Prefer reversible adapters and versioned cache contracts over cross-platform
  rewrites.

## Delivery Categories and Dependencies

### Category 1: Testing and CI Foundation

Category 1 lands first and becomes the required quality gate for all later
categories.

The project will retain the existing Node test runner. Vitest is not justified
for the initial architecture because current tests already execute TypeScript
utilities quickly without a duplicate framework. A later migration may be
considered if component integration testing materially outgrows the current
runner.

The CI workflow will run:

- `pnpm install --frozen-lockfile`
- Biome formatting and import-order validation
- `pnpm lint`
- `pnpm typecheck`
- every configured mobile, web, and core test script
- focused authentication, cache-key, localized-image, and search tests as they
  are added
- `pnpm build:web`, including the existing Open Graph bundle checks

Pull-request and branch runs will use concurrency cancellation. Tests will use
mocked adapters and will not connect to production Supabase, Upstash, Redis, or
TMDB data.

### Categories 2, 3, and 4

After Category 1 passes, authentication, locale/cache, and search-core work may
proceed concurrently only in isolated worktrees with disjoint ownership.

Shared integration files are coordinator-owned:

- `packages/core/src/index.ts`
- root and workspace manifests
- `pnpm-lock.yaml`
- shared application providers and layouts
- shared configuration files

Category agents produce focused modules and tests but do not independently edit
these integration files.

### Category 5

The server search gateway begins only after Category 4 contracts are stable and
reviewed.

### Category 6

Consumer migrations begin only after Categories 2 through 5 expose stable,
tested interfaces. Migration batches remain sequential when they touch shared
layouts, hooks, providers, or components.

## Category 2: Authentication Resolution

### Shared contract

`packages/core` will expose platform-neutral resolution types and pure
transition helpers:

```ts
export type AuthResolution<AuthUser> =
  | { status: 'resolving'; previousUser?: AuthUser }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }
  | {
      status: 'error'
      error: AuthResolutionError
      previousUser?: AuthUser
    }
```

The exact error fields will be serializable and must distinguish recoverable
refresh errors from authoritative authentication invalidation.

### Authentication lifecycle distinctions

The platform adapters must distinguish four independent concerns:

1. **Initial authentication resolution** starts before protected content is
   rendered. A persisted Supabase session is restored or definitively found
   absent. During this phase, protected screens render page-shaped skeletons.
2. **Background token refresh** occurs while a previously valid session remains
   usable. A temporary refresh failure retains authenticated state and records a
   recoverable error for retry or telemetry. It must not show logged-out UI.
3. **Definitive authentication failure** occurs after explicit logout,
   authoritative Supabase invalidation, an expired session that cannot be
   refreshed, or a persistent failure classified as invalid authentication.
   This produces either a typed error or definitive unauthenticated state.
4. **Profile-data readiness** begins only after session authentication is known.
   Profile loading or failure may produce a local skeleton or profile-specific
   error, but it cannot redefine the Supabase session as unauthenticated.

### Web adapter

The web adapter remains compatible with the existing Zustand and Supabase
architecture. It is initialized once above `AppShell`, subscribes once to auth
changes, and preserves the last valid session during refresh.

It provides:

- stable `AuthResolution`
- current session and authenticated user
- explicit profile readiness
- safe callback and `returnTo` handling
- typed resolution and refresh errors
- explicit logout behavior

### Mobile adapter

The mobile adapter remains a React context mounted above Expo Router. It waits
for persisted Supabase session restoration before protected tabs render and
keeps OAuth/deep-link completion idempotent.

It provides the same logical state as web while retaining Expo-specific
navigation, deep-link handling, and application-state token refresh.

### Protected gate

Platform UI packages will provide equivalent protected-content gates. The gate
does not fetch data; it only enforces state ordering:

1. auth resolving
2. definitive unauthenticated
3. authenticated page query pending
4. page error
5. authenticated empty state
6. loaded content

Background refresh with a previous user remains in the authenticated branch.

### Authentication acceptance criteria

- A valid persisted session never renders logged-out illustrations during
  restoration or token refresh.
- A missing session renders unauthenticated UI only after initial resolution.
- Explicit logout renders unauthenticated UI.
- Profile loading does not affect session authentication.
- Callback completion is idempotent and preserves only safe internal return
  destinations.
- Persistent or authoritative invalidation eventually becomes typed error or
  unauthenticated state.

## Category 3: Locale-Ready Caching and Localized Images

### Locale readiness

Each platform will expose a locale-resolution state. Locale-sensitive queries
remain disabled until persisted locale hydration completes.

- Web hydrates the persisted settings store before enabling title queries.
- Mobile awaits AsyncStorage language restoration at the root boundary.
- A page-shaped skeleton is shown while locale is unresolved.
- A default-language title or poster is never rendered as temporary content for
  a different selected locale.

### Query-key factories

Pure deterministic factories in `packages/core` will encode every
response-changing input:

- schema version
- resource
- TMDB ID and media type
- normalized locale
- region
- public or authenticated scope
- user ID when authenticated data varies by user
- filters
- pagination

Representative API:

```ts
titleQueryKeys.details({
  id,
  mediaType,
  locale,
  region,
  scope,
})
```

Factories return serializable readonly tuples. Invalidation and cache seeding
use factory prefixes rather than repeated handwritten arrays.

### Cache policy

Initial localized-title defaults are centralized as named policy values:

```ts
LOCALIZED_TITLE_STALE_TIME = 24 hours
LOCALIZED_TITLE_GC_TIME = 7 days
```

These are defaults, not universal mandates. Individual resources may override
them when justified by volatility, memory usage, provider behavior, or existing
product behavior. Overrides must be named, documented, and tested rather than
duplicated numeric constants.

### Localized image resolver

A pure resolver in `packages/core` selects poster, backdrop, profile, logo, or
fallback assets with deterministic priority:

1. exact normalized locale
2. base language
3. configured fallback locale
4. original content language
5. language-neutral image
6. TMDB default image
7. Kino placeholder

Quality metadata, aspect ratio, and vote information provide deterministic
tie-breaking within the same language tier. Missing or malformed paths are
ignored.

The final image source is computed before rendering. Image components keep a
stable source, show a skeleton until it is known, and use only a locale-valid
fallback on load error.

### Cache hydration and prefetching

Localized list responses will contain final presentation summaries wherever
possible. List adapters seed the compatible localized summary/detail cache.
Detail pages may use this data only when locale, region, media type, and scope
match.

Prefetch adapters support:

- pointer hover and keyboard focus on web
- touch start and navigation intent on mobile
- route prefetch where supported
- near-visible cards only when list size and network policy justify it

Prefetching uses React Query deduplication and fetches localized summaries by
default, not full details for every list item.

### Localization acceptance criteria

- Locale changes produce independent cache entries.
- Region-sensitive data is separated by region.
- Public and authenticated responses do not collide.
- Cards and details share compatible normalized localized summaries.
- Posters and localized metadata do not visibly swap after render.
- Prefetching does not create duplicate or list-wide full-detail requests.

## Category 4: Shared Semantic Search Domain

### Module boundaries

```text
packages/core/src/search/types.ts
packages/core/src/search/normalize.ts
packages/core/src/search/intent.ts
packages/core/src/search/rank.ts
packages/core/src/search/fusion.ts
packages/core/src/search/person-expansion.ts
packages/core/src/search/documents.ts
packages/core/src/search/index.ts
```

These modules accept and return plain data. They do not import provider clients,
read environment variables, or perform network requests.

### Search contracts

Shared contracts define:

- versioned `SearchRequest`
- locale and region
- media constraints
- pagination and limits
- normalized movie, series, person, and user entities
- grouped `SearchResponse`
- provider candidate inputs
- typed fallback and temporary-unavailable errors
- platform-neutral route data

### Intent and ranking

Intent detection combines lexical signals and provider confidence:

- exact or near-exact title
- title plus release year
- exact or high-confidence person name
- actor, director, creator, or writer relationship phrase
- franchise
- descriptive semantic discovery
- structured media-type constraints
- ambiguous intent

Ranking combines bounded components:

- exact match
- prefix match
- semantic similarity
- entity confidence
- relationship relevance
- locale relevance
- popularity and vote confidence
- release relevance where applicable

Popularity cannot override weak semantic or relationship relevance.
Deterministic tie-breaking uses normalized entity identity and stable metadata.

### Person expansion

One high-confidence top person may be expanded. Acting results prioritize
prominent cast roles and de-emphasize self or archive appearances. Director and
creator intent prioritizes matching crew departments over acting appearances.
Credits are ranked, deduplicated, and divided into movie and series groups.

For `Marlon Brando`, the response can place the person first, followed by ranked
associated titles, then weaker semantic title matches.

### Index document boundary

Pure document-building logic produces:

```ts
type SearchIndexDocument = {
  id: string
  entityType: 'movie' | 'series' | 'person'
  searchableText: string
  metadata: SearchIndexMetadata
  contentHash: string
  indexVersion: number
}
```

This prepares a later background indexer without introducing a worker framework
in this project.

## Category 5: Server Search Gateway

### Endpoint

The Next.js application exposes a stateless, versioned route:

```text
POST /api/v1/search
```

The route returns the shared platform-neutral JSON contract. Neither mobile nor
shared core depends on Next.js response internals.

### Provider boundary

The route composes server-only adapters:

- Upstash Vector query adapter
- optional Upstash Redis rate-limit/cache adapter when configured
- TMDB search/person/credit/localization adapter
- shared-core intent, fusion, expansion, and ranking

Provider adapters receive `AbortSignal`, enforce timeouts, and return normalized
plain candidates.

### Security and validation

- Upstash URL and token use server-only environment names.
- Client-prefixed Upstash variables are removed from mobile, Next configuration,
  documentation, and deployment examples.
- Requests have query-length, result-limit, pagination, media-filter, locale,
  and region validation.
- Provider failures are sanitized.
- Rate limiting uses an existing trusted store where available and a bounded
  in-process development fallback only for local use.
- Native mobile requests do not require wildcard browser CORS. Browser access
  remains same-origin unless a narrowly configured preview origin is required.

### Fallback

1. Sufficient Upstash candidates: return hybrid ranked results.
2. Weak or empty Upstash candidates: supplement with TMDB.
3. Upstash timeout or failure: return TMDB fallback.
4. TMDB also fails: return typed temporary-unavailable response.

The existing TMDB fallback is retained until both mobile and web gateway clients
are verified.

### Mobile API origin

Mobile uses `EXPO_PUBLIC_KINO_API_URL` only as the public Kino API origin.

- The URL is normalized and validated by a platform adapter.
- Production builds fail configuration validation when it is absent.
- Production never silently defaults to localhost.
- Local and preview builds accept an explicitly configured LAN address, tunnel,
  or deployed preview origin.
- Documentation warns that physical-device `localhost` refers to the device.

No provider credential is exposed through this value.

## Category 6: Audited Consumer Migrations

### Batch A: Authentication consumers

- root authenticated boundaries
- mobile tab layout
- web protected layouts
- login/register callbacks
- account and profile entry points

Gate: no unauthenticated flash, no redirect loop, persisted sessions survive
refresh, callbacks retain safe destinations.

### Batch B: High-traffic localized title consumers

- home rows
- search cards
- diary cards
- profile title rows
- title detail header

Gate: no localized image swap, separate locale cache entries, compatible detail
prefetch, no excessive request fan-out.

### Batch C: Remaining title and person consumers

- watchlists
- import previews
- recommendations and franchise rows
- person pages
- secondary dialogs and modals

### Batch D: Semantic-search consumers

- mobile autocomplete and full search
- web autocomplete and full search
- shared gateway clients
- removal of direct client Upstash access and public-prefixed credentials

The TMDB gateway fallback remains active.

### Batch procedure

Every batch:

1. lists exact consumers and ownership
2. adds failing regression tests
3. records the expected failure
4. migrates only that consumer set
5. runs focused tests
6. runs lint and type-check
7. runs the relevant application build
8. reviews request fan-out and cache keys
9. receives specification-compliance review
10. receives code-quality and maintainability review
11. receives independent verification
12. lands as an independent conventional commit

## Worktree and Agent Strategy

After the specification and plans are approved:

1. Create an isolated integration worktree from
   `codex/kino-auth-cache-search`.
2. Complete and integrate Category 1.
3. Create separate worktrees for authentication, localization/cache, and search
   core.
4. Assign non-overlapping ownership and forbid category agents from shared
   integration files.
5. Review and integrate each category through specification and quality review.
6. Start the gateway only after search-core contracts are stable.
7. Run migration batches sequentially when shared UI boundaries overlap.

Each agent must report architectural findings, files changed, interfaces
produced and consumed, tests added, commands run, and unresolved risks. The
coordinator independently reruns relevant verification.

## Commit Strategy

No implementation commit lands directly on `main`. Commits use:

```text
<type>[scope]: <description>

<body>
```

Category and migration commits remain independently revertible. Shared
integration changes are committed by the coordinator after compatibility
review.

## Rollback Strategy

- Category 1 is additive and remains useful if later work is rolled back.
- Auth adapters wrap the existing Supabase architecture and can be reverted
  without changing persisted session storage.
- Cache keys include schema versions, preventing older code from interpreting
  newer entries incorrectly.
- Consumer localization migrations can be reverted batch by batch while pure
  factories remain inert.
- The server gateway retains TMDB fallback throughout rollout.
- Direct client Upstash code is removed only in Batch D after both gateway
  clients pass verification.
- Each migration batch is an independent commit.
- No database rollback is required.

## Verification Strategy

Before any category completion claim, run fresh relevant commands and inspect
their output. Final verification includes:

- `pnpm lint`
- `pnpm typecheck`
- all configured tests
- `pnpm build:web`
- Biome formatting and import-order checks
- focused authentication tests
- locale and region cache-key tests
- localized-image resolver tests
- prefetch deduplication tests
- search intent, expansion, fusion, and ranking tests
- gateway validation, timeout, fallback, and provider-failure tests
- mobile gateway configuration tests
- browser smoke tests where configured
- practical mobile checks where the environment permits
- secret and client-bundle scans for Upstash credentials

Manual acceptance covers rapid protected-tab navigation, persisted-session
refresh, token refresh, explicit logout, locale changes, localized card/detail
navigation, representative person and semantic queries, and Upstash failure.

## Deferred Work

The following boundaries are prepared but not implemented:

- persisted offline React Query caches
- offline mutation queues and reconciliation
- a worker framework for indexing or refresh jobs
- embedding-generation pipelines
- a new recommendation engine
- collaborative recommendation ranking

These require separate designs after the reliability and gateway architecture
is proven.

## Completion Criteria

The project is complete only when:

- every category and migration batch passed TDD, both review stages, and fresh
  verification
- protected UI never infers unauthenticated state from unresolved `user`
- temporary refresh failures preserve a previously valid session
- authoritative invalidation eventually resolves to typed error or
  unauthenticated state
- locale is ready before localized queries render
- localized posters and metadata do not visibly swap
- query keys isolate locale, region, scope, pagination, and schema
- prefetching is deduplicated and bounded
- mobile and web use the shared search contract and server gateway
- person queries expand ranked credits
- client bundles contain no Upstash credentials or provider clients
- TMDB fallback remains usable
- the working tree and commit history reflect independently reviewable batches
