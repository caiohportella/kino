# Kino Server Search Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stateless `/api/v1/search` gateway that orchestrates a server-only vector provider and TMDB fallback, then delegates all ordering to shared core.

**Architecture:** The route validates transport input and calls injected server adapters. Upstash is one concrete `VectorSearchProvider`; shared contracts and clients remain vendor-neutral. Locale presentation resolves before versioned response serialization.

**Tech Stack:** Next.js route handlers, `@upstash/vector` server-only, TMDB service, shared core, Node test runner.

## Global Constraints

- Categories 1, 4, and 4B are stable and integrated.
- Work in a gateway worktree.
- Never expose vector credentials through public-prefixed variables.
- Ranking remains exclusively in core.
- Coordinator owns manifests, lockfile, `next.config.ts`, environment examples, and shared exports.
- TMDB fallback remains active.

---

### Task 1: Transport Validation and Version Negotiation

**Files:**
- Create: `apps/web/lib/search/request.ts`
- Create: `apps/web/lib/search/request.test.mjs`
- Create: `apps/web/lib/search/errors.ts`

**Interfaces:**
- Produces: `parseSearchRequestV1(json): SearchRequestV1`
- Produces typed `unsupported_version`, `invalid_request`, `rate_limited`, and `temporary_unavailable` responses.
- Limits query to 200 Unicode code points, page to 100, and result limit to 50.

- [ ] **Step 1: Write failing validation tables**

Cover supported/unsupported schemas, empty/oversize query, invalid locale/region/media type, negative page, excessive limit, and additive unknown optional fields.

- [ ] **Step 2: Verify RED**

Run web tests; expect missing parser.

- [ ] **Step 3: Implement parser and typed errors**

Do not leak raw parser/provider messages.

- [ ] **Step 4: Verify GREEN**

Run web tests.

- [ ] **Step 5: Commit**

```text
feat[search-api]: validate versioned search requests

Reject malformed or unsupported gateway input with platform-neutral typed responses.
```

### Task 2: Vendor-Neutral Provider Adapters

**Files:**
- Create: `apps/web/lib/search/providers/vector.ts`
- Create: `apps/web/lib/search/providers/upstash-vector.ts`
- Create: `apps/web/lib/search/providers/upstash-vector.test.mjs`
- Create: `apps/web/lib/search/providers/tmdb.ts`
- Create: `apps/web/lib/search/providers/tmdb.test.mjs`
- Create: `apps/web/lib/search/server-env.ts`
- Create: `apps/web/lib/search/server-env.test.mjs`

**Interfaces:**
- Produces: server `VectorSearchProvider`.
- Produces: `createUpstashVectorProvider({ url, token, fetch })`.
- Produces: `TmdbSearchProvider`.
- Provider methods accept `AbortSignal`.

- [ ] **Step 1: Write failing provider-boundary tests**

Use full fake provider payloads for success, timeout, malformed metadata, and replacement provider through the same interface. Assert normalized output contains no Upstash fields.

- [ ] **Step 2: Verify RED**

Run web tests; expect missing adapters.

- [ ] **Step 3: Implement server-only environment and adapters**

Read only `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN`. No `NEXT_PUBLIC_` fallback.

- [ ] **Step 4: Verify GREEN and credential scan**

Run tests and scan client modules for provider SDK imports.

- [ ] **Step 5: Coordinator moves the provider dependency to the server package**

Add `@upstash/vector` to `apps/web/package.json`, remove it from
`packages/core/package.json`, and update `pnpm-lock.yaml`. Keep the mobile
dependency until migration Batch D so the existing client remains rollback-safe.

- [ ] **Step 6: Commit**

```text
feat[search-api]: add server-only provider adapters

Normalize Upstash Vector and TMDB candidates behind vendor-neutral abortable interfaces.
```

### Task 3: Gateway Orchestrator and Fallback

**Files:**
- Create: `apps/web/lib/search/gateway.ts`
- Create: `apps/web/lib/search/gateway.test.mjs`
- Create: `apps/web/app/api/v1/search/route.ts`
- Create: `apps/web/lib/search/route-handler.ts`

**Interfaces:**
- Produces: `createSearchGateway(dependencies).search(request, signal): Promise<SearchResponseV1>`
- Produces: Next route that only parses request, supplies signal, and serializes typed response.

- [ ] **Step 1: Write failing orchestration tests**

Cover sufficient vector results, weak supplementation, vector timeout, TMDB fallback, both failures, one top-person expansion, cancellation, deduplication, and deterministic response order.

- [ ] **Step 2: Verify RED**

Run web tests; expect missing gateway.

- [ ] **Step 3: Implement canonical lifecycle orchestration**

Call shared `runSearchPipelineV1`; do not sort in route/gateway code. Resolve localized presentation using centralized localization contracts after shared ordering.

- [ ] **Step 4: Verify GREEN**

Run gateway and route tests. Assert TMDB-only operation succeeds without vector configuration.

- [ ] **Step 5: Commit**

```text
feat[search]: add hybrid server search gateway

Orchestrate vector candidates, person credits, localized presentation, and TMDB fallback through shared ranking.
```

### Task 4: Abuse Protection and Observability

**Files:**
- Create: `apps/web/lib/search/rate-limit.ts`
- Create: `apps/web/lib/search/rate-limit.test.mjs`
- Create: `apps/web/lib/search/observability.ts`
- Create: `apps/web/lib/search/observability.test.mjs`
- Modify: `apps/web/lib/search/route-handler.ts`

**Interfaces:**
- Produces bounded rate limiter with optional trusted Redis adapter and local-development memory adapter.
- Produces structured `SearchGatewayEvent`.
- Query logging uses a fingerprint, not raw text.

- [ ] **Step 1: Write failing behavior tests**

Assert rate-limit rejection, fallback path event, cancellation not counted as provider failure, secret/header redaction, trace ID presence, and metric sink failure isolation.

- [ ] **Step 2: Verify RED**

Run web tests; expect missing modules.

- [ ] **Step 3: Implement non-blocking observability and limiter**

Same-origin web needs no wildcard CORS. Native requests are accepted without adding broad browser CORS headers.

- [ ] **Step 4: Verify GREEN**

Run tests with an observability sink that throws; search response must still succeed.

- [ ] **Step 5: Review and commit**

Specification review: server-only credentials, fallback, versioning, ranking delegation.
Quality review: stateless request path and sanitized structured events.

```text
feat[search-api]: add abuse and gateway telemetry boundaries

Rate-limit requests and record sanitized fallback, latency, cancellation, and version events without affecting responses.
```

## Category Verification

Run web tests, typecheck, lint, build, OG checks, and client credential scans. Expected: all pass; `/api/v1/search` works with vector success and TMDB-only fallback.
