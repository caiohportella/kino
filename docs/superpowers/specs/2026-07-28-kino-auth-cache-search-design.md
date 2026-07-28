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
- Version shared contracts independently of transport URLs and cache schemas.
- Describe semantic retrieval through vendor-neutral capabilities. Upstash names
  appear only in the concrete server adapter and deployment configuration.
- Keep search ranking algorithms exclusively in `packages/core`.
- Keep search and indexing as separate pure domains.
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
- contract compatibility, provider abstraction, indexing, observability, and
  rollback compatibility tests as their interfaces land
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

The server search gateway begins only after Category 4 search contracts and
Category 4B indexing/provider-boundary contracts are stable and reviewed.

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
packages/core/src/search/pipeline.ts
packages/core/src/search/index.ts
```

These modules accept and return plain data. They do not import provider clients,
read environment variables, or perform network requests.

### Versioned search contracts

Shared contracts define:

- `SEARCH_SCHEMA_VERSION`
- `SearchRequestV1`
- `SearchResponseV1`
- `SearchResultV1`
- locale and region
- media constraints
- pagination and limits
- normalized movie, series, person, and user entities
- grouped response sections
- provider candidate inputs
- typed fallback and temporary-unavailable errors
- platform-neutral route data

Clients send the schema version in `SearchRequestV1`; the gateway includes the
schema version in every successful `SearchResponseV1`. Search React Query keys
encode `SEARCH_SCHEMA_VERSION` in addition to the `/api/v1/search` transport
version.

Compatibility rules:

- Non-breaking changes are additive optional fields with unchanged meaning.
- Removing, renaming, changing the meaning of a field, changing ordering
  semantics, or making an optional field required is breaking and requires a
  new schema version.
- The gateway accepts every explicitly supported request schema during mobile
  deployment propagation and adapts it to the current internal pipeline.
- Unsupported versions receive a typed `unsupported_version` response with the
  supported version range and an upgrade-required indicator.
- A gateway deployment cannot require an immediate mobile-store release.
- Obsolete schemas are removed only after contract-version telemetry confirms
  deployed clients no longer use them.

The URL version and schema version are related but independent. `/api/v1/search`
may support multiple compatible schema versions during rollout.

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

### Exclusive ranking ownership

Search ranking algorithms are owned exclusively by `packages/core`. Ranking
must not be reimplemented or independently adjusted inside Next.js route
handlers, React Query hooks, mobile screens, web components, provider adapters,
or platform API clients.

The gateway may orchestrate providers and pass normalized candidates to shared
ranking functions. Platform consumers may control presentation, grouping
layout, and pagination display, but cannot modify ranking scores or ordering.

Every future ranking change must:

- occur in shared core
- include regression tests
- preserve deterministic behavior
- update the ranking or search schema version when compatibility requires it
- be consumed equally by mobile and web

### Person expansion

One high-confidence top person may be expanded. Acting results prioritize
prominent cast roles and de-emphasize self or archive appearances. Director and
creator intent prioritizes matching crew departments over acting appearances.
Credits are ranked, deduplicated, and divided into movie and series groups.

For `Marlon Brando`, the response can place the person first, followed by ranked
associated titles, then weaker semantic title matches.

### Canonical search lifecycle

The canonical lifecycle is:

1. Validate request.
2. Normalize query.
3. Detect intent and constraints.
4. Fetch lexical, semantic, person, and TMDB candidates as required.
5. Normalize provider candidates.
6. Expand person relationships when confidence permits.
7. Normalize provider scores.
8. Fuse candidate sources.
9. Rank using shared-core rules.
10. Deduplicate.
11. Group by result type.
12. Resolve locale-sensitive presentation.
13. Paginate or trim according to the request.
14. Return the versioned response.

The server gateway owns request validation, provider orchestration, timeouts,
and presentation-data fetching. Shared core owns query normalization, intent
detection, provider-score normalization, relationship expansion rules, fusion,
ranking, deduplication, grouping rules, and deterministic tie-breaking.
Locale-sensitive presentation uses the centralized localization contracts.
Platform applications own rendering only.

Ranking uses normalized language-independent entity metadata wherever possible.
Locale relevance is an explicit shared ranking input; presentation code cannot
reorder results. Final localized titles, summaries, images, years, routes, and
provider-region data are resolved after ordering and before pagination or
response serialization. If presentation availability affects eligibility, that
fact is supplied as a normalized ranking constraint rather than applied as an
implicit UI adjustment.

## Category 4B: Shared Indexing Domain

Search and indexing are separate domains. Search consumes provider candidates
but does not construct documents, prepare embeddings, own index versions,
synchronize indexes, or perform provider writes.

### Module boundaries

```text
packages/core/src/indexing/types.ts
packages/core/src/indexing/documents.ts
packages/core/src/indexing/content-hash.ts
packages/core/src/indexing/version.ts
packages/core/src/indexing/index.ts
```

The indexing domain owns index document contracts, document construction,
searchable-text composition, metadata normalization, content hashing, index
schema versioning, embedding input preparation, and pure incremental-indexing
decisions.

It remains platform-neutral and cannot instantiate provider SDKs, read
environment variables, write to a provider, fetch TMDB, schedule jobs, or
depend on Next.js, Expo, React, Supabase, browser APIs, or storage APIs.

### Versioned index contracts

Pure document-building logic produces:

```ts
type SearchIndexDocumentV1 = {
  id: string
  entityType: 'movie' | 'series' | 'person'
  searchableText: string
  metadata: SearchIndexMetadataV1
  contentHash: string
  indexVersion: number
}
```

`SEARCH_INDEX_SCHEMA_VERSION` identifies document interpretation independently
from `SEARCH_SCHEMA_VERSION`. Content hashes are stable for identical normalized
inputs. An index-schema change intentionally changes the version and prevents
documents with incompatible metadata interpretations from being mixed.

Canonical indexing flow:

```text
TMDB or normalized media data
→ shared indexing document builder
→ server-side vector provider adapter
→ vector index
```

Canonical search flow:

```text
search request
→ provider candidates
→ shared search pipeline
→ normalized grouped response
```

The server adapter or a future worker supplies normalized TMDB data to the
document builder, then sends documents to the provider. Search never knows how
the candidates were indexed.

Dependency direction is enforced in tests and review:

- search modules cannot import indexing builders or depend on indexing side
  effects
- indexing modules cannot import search pipelines, provider SDKs, environment
  helpers, or platform APIs
- server adapters may import both domains and translate between their plain
  contracts
- clients import versioned search contracts but never indexing contracts,
  provider adapters, or provider SDKs

## Category 5: Server Search Gateway

### Endpoint

The Next.js application exposes a stateless, versioned route:

```text
POST /api/v1/search
```

The route returns the shared platform-neutral JSON contract. Neither mobile nor
shared core depends on Next.js response internals.

### Vendor-neutral provider boundary

Shared contracts describe capabilities rather than Upstash:

```ts
export interface VectorSearchProvider {
  search(
    request: VectorSearchRequest,
    signal?: AbortSignal
  ): Promise<VectorSearchResult>

  upsert?(
    documents: readonly SearchIndexDocumentV1[],
    signal?: AbortSignal
  ): Promise<void>

  delete?(
    documentIds: readonly string[],
    signal?: AbortSignal
  ): Promise<void>
}
```

Exact provider request/result types will be fixed in implementation planning.
They contain plain normalized data. Clients never know which provider is active,
and replacing the provider cannot require mobile or web consumer changes.

Provider-neutral shared names include `VectorSearchProvider`,
`SemanticCandidate`, `SearchProviderResult`, and `SearchIndexDocumentV1`.
Names such as `UpstashSearchClient`, `UpstashSearchResult`, or
`UpstashDocument` are permitted only inside the concrete server adapter.

The route composes server-only adapters:

- `VectorSearchProvider`, initially implemented by an Upstash Vector adapter
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

### Observability

The gateway uses existing logging and monitoring facilities and defines stable
structured events without requiring a new observability vendor. Observable
aggregate measures include:

- request and provider latency
- gateway timeout rate
- vector-provider and TMDB failure rates
- fallback and weak-result supplementation frequency
- zero-result and person-expansion frequency
- rate-limit rejection and request-cancellation frequency
- result count by source
- cache hit or reuse rate where observable
- request contract-version usage

Events include request or trace identifiers, distinguish client cancellation
from provider/server failure, and identify the fallback path used. They exclude
credentials, tokens, sensitive headers, and unnecessary raw user data. Search
queries use redaction or normalized fingerprints where sufficient.

Persistent raw-query retention and ranking-quality analytics require a separate
privacy review. Logging or metrics failures never fail a search request.

### Mobile API origin

Mobile uses `EXPO_PUBLIC_KINO_API_URL` only as the public Kino API origin.

- The URL is normalized and validated by a platform adapter.
- Production builds fail configuration validation when it is absent.
- Production never silently defaults to localhost.
- Local and preview builds accept an explicitly configured LAN address, tunnel,
  or deployed preview origin.
- Documentation warns that physical-device `localhost` refers to the device.

No provider credential is exposed through this value.

### Statelessness

The gateway remains stateless and does not perform large indexing writes during
user search requests. Provider writes are optional adapter capabilities reserved
for future indexing commands or workers, not the request path.

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

Old and new cache-key schemas may coexist during deployment and rollback.
Cache-schema versioning prevents entries produced under one interpretation from
being consumed under an incompatible interpretation. New factories never
reinterpret old cache entries.

Deployment compatibility rules:

- Old mobile builds may continue calling every still-supported gateway schema.
- The gateway tolerates supported older request versions during deployment
  propagation.
- Unsupported schemas receive a typed upgrade-required or
  unsupported-version response.
- Shared response changes remain additive unless the API or schema version
  changes.
- A server deployment never requires an immediate mobile-store release.
- Consumer migrations can be reverted independently while shared factories
  remain present.
- TMDB fallback remains available during rollout and rollback.
- Obsolete contract versions are removed only after telemetry confirms they are
  no longer used.
- Public Upstash environment-variable cleanup occurs as a separate verified
  deployment step after client-bundle validation.

Rollback checkpoints are independently verified after:

1. shared contract integration
2. server gateway deployment
3. web gateway client migration
4. mobile gateway client migration
5. removal of direct client-side Upstash usage
6. removal of public Upstash environment variables

The first four checkpoints can be rolled back without removing the TMDB
fallback. Checkpoints five and six occur only after both clients pass bundle,
fallback, and behavior verification.

## Future Recommendation Compatibility

The semantic-search entities, indexing documents, normalized relationship
metadata, localized media contracts, and deterministic scoring utilities are
designed to become reusable inputs for future recommendation pipelines. No
recommendation engine is introduced in this phase.

Future recommendation work may reuse normalized title/person entities, genres,
keywords, cast/director/creator relationships, popularity and freshness
metadata, localized title/image selection, semantic index documents, content
hashes, index versions, separately contracted followed-user signals, and
explainable recommendation reasons.

Recommendation indexing should reuse the shared indexing document builder where
appropriate. Recommendation-specific scoring belongs to a separate
`packages/core` recommendation domain. Search ranking must not gradually become
a hidden recommendation engine. Personalization signals cannot enter public
search results or cache keys without explicit authenticated-scope separation.

## Future Background-Worker Compatibility

Background workers are intentionally excluded from this implementation.
Indexing contracts, pure document builders, content hashes, index versions, and
provider adapters are designed so indexing can later execute asynchronously
without changing search consumers.

Future workers may perform TMDB and localized metadata refresh, search-document
rebuilding, embedding generation, incremental index upserts, stale-document
deletion, recommendation-profile rebuilding, watch-provider refresh, episode
availability refresh, and cache-invalidation events.

No worker framework is selected or installed in this phase. A future worker
consumes shared indexing contracts; it does not move search normalization,
intent, fusion, or ranking out of shared core.

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
- supported and unsupported request schemas
- additive response compatibility and schema-version cache keys
- old-client/new-gateway compatibility
- vector-provider success, replacement, timeout, and malformed candidates
- verification that provider-specific fields cannot escape normalized contracts
- deterministic index document construction and stable content hashes
- index-version changes when interpretation changes
- search modules remaining independent of indexing side effects
- indexing modules remaining free of provider SDKs and environment access
- verification that route handlers delegate ordering to shared core
- identical mobile/web ordering for identical normalized inputs
- structured fallback and cancellation observability
- log redaction and observability-failure isolation
- old/new cache-schema non-collision and TMDB-only gateway operation
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
- clients and the gateway negotiate supported shared contract versions
- search and indexing remain separate platform-neutral domains
- ranking rules have one shared-core owner
- provider-specific fields and SDKs remain inside server adapters
- observability failures cannot affect gateway responses
- person queries expand ranked credits
- client bundles contain no Upstash credentials or provider clients
- TMDB fallback remains usable
- the working tree and commit history reflect independently reviewable batches
