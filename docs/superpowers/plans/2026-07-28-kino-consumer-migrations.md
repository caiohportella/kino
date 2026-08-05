# Kino Audited Consumer Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate protected screens, localized media consumers, and mobile/web search to stable infrastructure in four independently verified batches.

**Architecture:** Each batch owns a fixed consumer list and lands as an independent commit. Shared providers/layouts, exports, manifests, lockfile, and configuration are coordinator-owned. Batches run sequentially where files overlap.

**Tech Stack:** Expo Router, Next.js App Router, React Query, shared core contracts, server search gateway.

## Global Constraints

- Categories 1 through 5 are stable and integrated.
- Do not combine batches.
- TDD regression tests precede each consumer migration.
- Preserve UI design, permissions, title routes, TMDB integration, and React Query.
- Keep TMDB gateway fallback throughout rollout and rollback.
- Remove public Upstash environment variables only after both clients and bundles are verified.

---

### Batch A: Authentication Consumers

**Files:**
- Modify (coordinator): `apps/mobile/app/_layout.tsx`
- Modify (coordinator): `apps/mobile/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/app/profile/[id].tsx`
- Modify: `apps/mobile/app/profile/import.tsx`
- Modify: `apps/mobile/app/profile/settings.tsx`
- Modify (coordinator): `apps/web/app/providers.tsx`
- Modify (coordinator): `apps/web/components/app-shell.tsx`
- Modify: `apps/web/app/diary/page.tsx`
- Modify: `apps/web/app/import/page.tsx`
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/app/watchlists/page.tsx`
- Modify: `apps/mobile/app/auth/callback.tsx`
- Modify: `apps/mobile/app/(auth)/login.tsx`
- Modify: `apps/mobile/app/(auth)/register.tsx`
- Modify: `apps/web/app/auth/callback/auth-callback-client.tsx`
- Modify: `apps/web/app/auth/login/page.tsx`
- Modify: `apps/web/app/auth/register/page.tsx`
- Create: `apps/mobile/utils/protectedConsumers.test.mjs`
- Create: `apps/web/lib/protected-consumers.test.mjs`

**Interfaces:**
- Consumes platform `AuthResolution` adapters and protected gates.
- Page queries remain separate from auth/profile state.

- [ ] Write failing tests proving resolving auth selects page skeleton before unauthenticated/empty branches.
- [ ] Run focused tests and record expected failures.
- [ ] Migrate root and tab boundaries first, then listed consumers.
- [ ] Verify valid/absent persisted sessions, delayed restoration, refresh failure, authoritative invalidation, callback return, duplicate callback, and explicit logout.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and relevant web build.
- [ ] Perform specification-compliance review and code-quality review.
- [ ] Commit:

```text
refactor[auth]: migrate protected consumers to resolution gates

Render skeletons during restoration and reserve unauthenticated states for definitive session outcomes.
```

### Batch B: High-Traffic Localized Consumers

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/(tabs)/search.tsx`
- Modify: `apps/mobile/app/(tabs)/diary.tsx`
- Modify: `apps/mobile/components/common/TitleCard.tsx`
- Modify: `apps/mobile/components/profile/WatchedMoviesSection.tsx`
- Modify: `apps/mobile/components/profile/WatchedSeriesSection.tsx`
- Modify: `apps/mobile/app/title/[id].tsx`
- Modify: `apps/web/app/discover/page.tsx`
- Modify: `apps/web/app/search/page.tsx`
- Modify: `apps/web/app/diary/page.tsx`
- Modify: `apps/web/components/media-card.tsx`
- Modify: `apps/web/components/media-row.tsx`
- Modify: `apps/web/components/profile-view.tsx`
- Modify: `apps/web/app/title/[id]/page.tsx`
- Create: `apps/mobile/utils/localizedConsumers.test.mjs`
- Create: `apps/web/lib/localized-consumers.test.mjs`

**Interfaces:**
- Consumes locale readiness, query factories, image resolver, localized summaries, prefetch helpers.

- [ ] Write failing tests showing no render before locale readiness and no fallback-locale placeholder.
- [ ] Run focused tests and record failures.
- [ ] Migrate list adapters to final localized summaries before cards.
- [ ] Seed compatible detail summary cache and add intent prefetch.
- [ ] Verify Portuguese-first render, language switch isolation, stable image source, and request deduplication.
- [ ] Inspect request counts; list rendering must not issue full detail per card.
- [ ] Run focused tests, lint, typecheck, and build.
- [ ] Complete both review gates.
- [ ] Commit:

```text
refactor[media]: migrate high-traffic localized title consumers

Render locale-ready summaries and stable posters with bounded detail prefetch.
```

### Batch C: Remaining Title and Person Consumers

**Files:**
- Modify: `apps/mobile/app/(tabs)/watchlists.tsx`
- Modify: `apps/mobile/app/watchlist/[id].tsx`
- Modify: `apps/mobile/app/profile/import.tsx`
- Modify: `apps/mobile/components/home/HomeSection.tsx`
- Modify: `apps/mobile/components/modals/PersonalityModal.tsx`
- Modify: `apps/mobile/components/modals/MediaImageSelectorModal.tsx`
- Modify: `apps/mobile/components/modals/WatchedMoviesModal.tsx`
- Modify: `apps/mobile/components/modals/WatchedSeriesModal.tsx`
- Modify: `apps/mobile/components/modals/WatchlistSelectorModal.tsx`
- Modify: `apps/web/app/watchlists/page.tsx`
- Modify: `apps/web/app/watchlists/[id]/page.tsx`
- Modify: `apps/web/app/watchlists/shared/[code]/page.tsx`
- Modify: `apps/web/app/import/page.tsx`
- Modify: `apps/web/components/banner-picker-dialog.tsx`
- Modify: `apps/web/components/title-context.tsx`
- Modify: `apps/web/app/person/[id]/page.tsx`
- Modify: `apps/web/components/profile-search-card.tsx`
- Create: `apps/mobile/utils/secondaryLocalizedConsumers.test.mjs`
- Create: `apps/web/lib/secondary-localized-consumers.test.mjs`

**Interfaces:**
- Same cache/image/prefetch contracts as Batch B; no new key or resolver implementation.

- [ ] Inventory exact consumers with `rg "poster_path|backdrop_path|useLocalized|queryKey:"`.
- [ ] Write failing regression tests for fallback order and stable sources.
- [ ] Migrate watchlist/import consumers and verify.
- [ ] Migrate recommendations/franchises/person consumers and verify.
- [ ] Migrate dialogs/modals and verify no locale-invalid temporary source.
- [ ] Run full tests, lint, typecheck, and build; inspect request fan-out.
- [ ] Complete both review gates.
- [ ] Commit:

```text
refactor[media]: migrate remaining localized consumers

Use shared locale keys, image selection, and summary prefetch across secondary title and person surfaces.
```

### Batch D: Gateway Search Consumers and Credential Removal

**Files:**
- Create: `apps/mobile/services/search-gateway.ts`
- Create: `apps/mobile/utils/searchGatewayConfig.ts`
- Create: mobile gateway/config tests
- Create: `apps/web/lib/search/client.ts`
- Create: web gateway-client tests
- Modify: `apps/mobile/hooks/api/useUpstashSearch.ts`
- Modify: `apps/mobile/hooks/useUpstashSearch.ts`
- Modify: `apps/mobile/app/(tabs)/search.tsx`
- Modify: `apps/web/app/search/page.tsx`
- Delete after verification: `apps/mobile/services/upstash.ts`
- Modify (coordinator): `apps/mobile/app.config.js`
- Modify (coordinator): `apps/mobile/package.json`
- Modify (coordinator): `packages/core/package.json` if the provider dependency was not already removed during gateway integration
- Modify (coordinator): `apps/web/next.config.ts`
- Modify (coordinator): root README/environment documentation
- Modify (coordinator): `pnpm-lock.yaml`

**Interfaces:**
- Mobile implements `SearchGateway.search(input, signal)`.
- Mobile validates `EXPO_PUBLIC_KINO_API_URL`; production missing value throws a typed configuration error.
- Web uses same-origin `/api/v1/search`.
- Both consume `SearchRequestV1`/`SearchResponseV1`.

- [ ] Write failing config tests for production missing URL, normalized deployed URL, explicit LAN/tunnel development URL, and rejection of silent production localhost.
- [ ] Write failing cancellation, timeout, typed-error, schema-version, pagination, and cache-key tests for both clients.
- [ ] Implement platform gateway clients without screen-level `fetch`.
- [ ] Migrate autocomplete to small bounded requests and full search to grouped pagination.
- [ ] Verify identical ordering for identical normalized responses and no literal-first semantic swap.
- [ ] Verify vector failure uses gateway TMDB fallback.
- [ ] Scan bundles/source for `EXPO_PUBLIC_UPSTASH`, `NEXT_PUBLIC_UPSTASH`, and client `@upstash/vector`.
- [ ] Only after both clients pass, delete direct mobile Upstash service and coordinator-remove public configuration/dependency.
- [ ] Run full validation and production build; document physical-device localhost behavior.
- [ ] Complete both review gates.
- [ ] Commit client migration:

```text
refactor[search]: migrate mobile and web to Kino gateway

Use versioned shared responses with cancellation, grouped results, and server-side TMDB fallback.
```

- [ ] Commit credential cleanup separately:

```text
chore[security]: remove client Upstash configuration

Delete direct provider access and public-prefixed vector credentials after gateway bundle verification.
```

## Rollback Checkpoints

Verify independently after shared contracts, gateway deployment, web client, mobile client, direct-client removal, and public-variable cleanup. Supported older mobile schemas remain accepted. Old/new cache keys coexist without collision.

## Final Verification

Run:

```text
pnpm biome check .
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web
```

Also run focused auth, locale-key, image, prefetch, search-domain, indexing, gateway, fallback, and configuration tests; browser smoke tests where configured; and practical mobile checks. Expected: all executable checks pass, no client Upstash credentials/SDKs remain, and working tree is clean.

## Final Review Gates

Specification review: map every migrated consumer to Batches A-D, confirm each
batch has its own commit, and confirm TMDB fallback remained active throughout.

Quality review: confirm screens contain no ad hoc auth resolution, locale query
keys, image-selection rules, ranking adjustments, direct gateway fetches, or
provider SDK access.
