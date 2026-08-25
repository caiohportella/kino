# Kino Local-First PWA Startup Design

**Date:** 2026-08-25  
**Status:** Approved design; implementation plan follows after review  
**Scope:** `apps/web` and the shared cache contracts it consumes

## Goal

Make repeat Kino PWA launches local-first: previously known content should be usable immediately from the correct device-local state, while network requests refresh it in the background. First-ever and uncached requests remain server-first where that gives a real first-paint benefit.

The design must preserve correctness across authenticated users, anonymous sessions, locales, deployments, cache schema changes, and service-worker updates. It must not turn the service worker into a second application-state persistence layer.

## Current constraints and findings

- `apps/web/app/providers.tsx` creates one memory-only `QueryClient`, blocks the whole tree behind the locale readiness state, and calls `router.refresh()` after locale hydration.
- `apps/web/stores/settings-store.ts` uses Zustand persistence with deferred hydration and starts in a `resolving` state.
- `apps/web/public/sw.js` uses one broad cache for navigations and same-origin GET requests, including resources that should not be treated as durable application state.
- The repository already has canonical locale/scope-aware cache keys in `packages/core/src/cache/query-keys.ts`, policy constants in `packages/core/src/cache/policies.ts`, and title summary/detail query helpers in `apps/web/lib/title`.
- `apps/web/hooks/title/use-title-data.ts` still uses legacy title keys and performs `getOrCreateTitle()` inside the public metadata query, so local database identity can delay public title presentation.
- Discover is server-first today. Several diary, activity, profile, and watchlist pages already use TanStack Query but gate their whole route on pending state.
- The working tree contains an unrelated change in `apps/web/components/layout/app-shell.tsx`; it must remain untouched.

## Architecture

### Context-keyed client lifecycle

The effective application cache context is:

```text
cache schema version + authenticated user ID (or anonymous) + Kino language
```

The persisted IndexedDB namespace and the in-memory `QueryClient` are the same isolation boundary. A context transition never mutates the active client in place while new observers can render. Instead, the provider boundary performs this sequence:

```text
active context
→ cancel in-flight work for the old client
→ flush the old client when it is an allowed authenticated/public namespace
→ remove old authenticated state on logout/user switch
→ derive the new context key
→ create a dedicated QueryClient and IndexedDB persister
→ restore that namespace
→ mount observers for the new client
→ let stale restored data render and revalidate in the background
```

During the transition, the application keeps its shell mounted but does not expose old query data to new-context observers. Route-level skeletons remain available only for data that is genuinely unknown in the new context; there is no root startup skeleton.

### Locale startup and reconciliation

The server-resolved language on `<html lang>` is the initial client language snapshot. This makes the first client render agree with server-rendered localized content and avoids a hydration mismatch. The persisted Zustand language is reconciled asynchronously after the first render.

If persisted settings match the server language, no route refresh occurs. If they differ, the client:

1. updates the settings store and `<html lang>`;
2. synchronously changes the effective cache context;
3. restores the matching locale namespace before new query observers render;
4. refetches locale-sensitive queries according to their normal stale policy; and
5. writes the language cookie so a later server render starts in the selected language.

Unsupported or unreadable settings fall back to Kino’s default language (`en`) without blocking the app.

### Query persistence

Use TanStack’s supported persistence provider with a small native IndexedDB persister. The persister stores one dehydrated client per context key in a versioned database/store. It exposes `persistClient`, `restoreClient`, and `removeClient` and degrades to a no-op persister if IndexedDB is unavailable.

Persistence is allowlist-based. A query is persisted only when all of the following are true:

- its query family has an explicit persistence classification;
- its state is successful and has serializable data;
- it is not a mutation or transient UI query; and
- it belongs to the active context’s public or authenticated scope.

Persisted data is not assumed fresh. The restored query keeps its `dataUpdatedAt`, can render immediately, and revalidates when its policy says it is stale.

The persistence buster includes the cache schema version and app persistence version. `maxAge` limits restored data to seven days. Policy `gcTime` values remove unused queries from the client before they can be persisted again. Namespace cleanup removes stale schema versions and authenticated namespaces that are no longer active, without deleting the active namespace.

The initial allowlist is:

| Query family | Scope | Stale time | Client GC / persistence intent |
| --- | --- | ---: | --- |
| canonical title summary/details and localized title batches | public or authenticated, locale-aware | 24 hours | 7 days |
| canonical profile identity and explicitly approved public/profile sections | public or authenticated | 5 minutes | 1 hour |
| watchlist list/details/items | authenticated or explicitly public | 5 minutes | 1 hour |
| diary entries and profile diary sections | authenticated | 5 minutes | 1 hour |
| activity feed | authenticated | 1 minute | 5 minutes |
| title personal state and title rating stats | authenticated | 2–5 minutes | 1 hour |
| stable public title context/recommendation data | public, locale-aware | 30 minutes | 1 day |

Discover data is persisted only when it has a client query contract with an explicit policy. Existing server-first Discover payloads are not copied into an opaque service-worker HTTP cache. Search autocomplete, auth/session/token state, mutations, errors, modal state, and unclassified queries are excluded.

On logout or user switch, both the old authenticated namespace and its in-memory `QueryClient` are cleared. Anonymous public data may remain in the anonymous locale namespace because it is reconstructable and not user-private.

### Service worker

Use separate versioned caches with a `kino-` prefix:

- shell cache for `/` and the manifest, used only as offline navigation fallback;
- immutable asset cache for fingerprinted `/_next/static/*`, fonts, icons, and safe static assets, using cache-first;
- approved image cache for stable poster/backdrop resources, using stale-while-revalidate.

Navigations use network-first and do not cache successful HTML forever. If a navigation fails, the worker serves the cached `/` shell. Private/API requests are network-only and are not inserted into a shared cache. For images, prefer same-origin optimized `/_next/image` resources when Kino uses them; only add explicitly approved remote image origins when URL identity and privacy semantics are safe. Non-OK responses are never cached.

Activation deletes only obsolete caches owned by Kino, then claims clients. Development registration continues to unregister stale workers.

### Title data contracts

Title navigation uses one canonical localized title query contract and distinguishes three data layers:

- `TitlePreview`: TMDb ID, media type, localized title, year, poster, and backdrop; enough for an immediate route transition and basic card/hero paint.
- `TitleCore`: complete public presentation metadata such as synopsis, genres, runtime, credits, seasons, external IDs, and public TMDb fields.
- `KinoTitleIdentity`: the local database title ID required for ratings, diary, watchlist, and other Kino actions.

`seedTitlePreview()` writes preview data into the exact canonical summary/detail contract used by the title route. It never fabricates complete metadata. The title detail query uses the preview as compatible placeholder/initial data, then replaces or enriches it with `TitleCore`. `KinoTitleIdentity` is resolved by a separate query and never blocks public core presentation.

Server-rendered title pages pass serialized public `TitleCore` data into the client through the canonical title query contract (TanStack hydration or equivalent correctly keyed initial data). This avoids a second cache island and makes an uncached title response useful while personal queries load separately.

### Navigation seeding and bounded prefetching

Reusable title preview seeding is wired at high-value title entry points: Discover cards, global search results, watchlists, profile rows, activity, and title recommendations. The helper normalizes locale, region, media type, image paths, and title route identity.

Route prefetching and lightweight summary prefetching are bounded by existing concurrency limits and user intent. Visible/first-N cards may prefetch during idle time; focus, pointer, or touch intent may prefetch immediately. Full detail dependencies such as reviews, providers, trailers, seasons, and recommendations are not eagerly prefetched for every card.

### Progressive rendering

The title page’s critical layer renders when it has preview or core data: backdrop/poster, title, year/basic metadata, synopsis when available, and actions whose required Kino identity/viewer state is ready. Personal state, ratings, seasons, reviews, providers, trailer, recommendations, and sidebar enrichment load independently.

When core data is cached, a background refetch does not replace the page with `TitleSkeleton`. A skeleton is used only when no preview/core data exists. Diary, activity, watchlist, profile, and Discover routes receive the same cached-data-first treatment where their existing query boundaries permit it, without a broad unrelated UI redesign. Expensive below-the-fold or desktop-only query owners are deferred or conditionally mounted when that can be done without changing the data contract.

## Error handling and safety

- IndexedDB open, read, write, and serialization failures are swallowed into a non-persistent client path; the app remains usable online.
- A corrupt or incompatible persisted client is removed and ignored; it never blocks route rendering.
- Authenticated queries are keyed with viewer identity and are stored only in authenticated namespaces.
- Locale-aware query keys and locale namespaces prevent localized data reuse across languages.
- Service-worker caching never stores non-OK responses or private API responses.
- Background refresh errors leave previously known successful data visible and surface only through existing page-level error affordances where appropriate.
- Persistence cleanup is bounded and never deletes the currently active namespace during a transition.

## Instrumentation

Development-only performance marks and measures cover:

- provider/context initialization;
- persisted-client restoration;
- time until cached content is available;
- background refresh start; and
- title navigation after preview seeding.

Production logging remains quiet. Instrumentation is designed to compare the user-facing scenarios rather than only internal function timings.

## Verification scenarios

Automated tests cover namespace construction, schema/user/locale isolation, provider lifecycle behavior, allowlist exclusions, restore across a new `QueryClient`, logout cleanup, locale changes, service-worker strategy decisions, title preview seeding, and preview-to-core enrichment.

The verification workflow also exercises:

1. first-ever uncached PWA launch;
2. reopening after several hours;
3. fully killed and reopened PWA;
4. poor-network reopen with successful cached content;
5. Discover-to-unseen-title navigation;
6. navigation to a previously visited title;
7. language change;
8. logout to anonymous;
9. logout followed by another user; and
10. a new deployment/cache schema.

The primary acceptance criterion is that previously known content becomes visible without waiting for network revalidation. Freshness updates are secondary.

## Scope boundaries

This change does not introduce a broad new UI visual language, duplicate server and client title query contracts, cache authenticated Supabase responses in the service worker, or persist arbitrary query state. It also does not alter the unrelated `app-shell.tsx` working-tree change.

