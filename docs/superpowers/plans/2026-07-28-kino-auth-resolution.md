# Kino Authentication Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate initial auth resolution, background refresh, definitive invalidation, and profile readiness so protected UI never flashes logged-out content.

**Architecture:** Pure state transitions live in core; web and mobile adapters preserve existing Supabase/Zustand/context architecture. This category creates contracts and gates but defers broad consumer migration to the migration plan.

**Tech Stack:** TypeScript, Supabase Auth, Zustand, React context, Node test runner.

## Global Constraints

- Category 1 must already pass.
- Work in an isolated auth worktree.
- Do not edit localization, search, or indexing modules.
- `packages/core/src/index.ts`, providers, layouts, manifests, and lockfiles are coordinator-owned.
- Temporary refresh failure preserves a previous valid session.
- Authoritative invalidation eventually becomes typed error or unauthenticated.

---

### Task 1: Pure Auth Resolution State Machine

**Files:**
- Create: `packages/core/src/auth/types.ts`
- Create: `packages/core/src/auth/resolution.ts`
- Create: `packages/core/src/auth/resolution.test.mjs`
- Create: `packages/core/src/auth/index.ts`
- Modify (coordinator): `packages/core/src/index.ts`

**Interfaces:**
- Produces: `AuthResolution<AuthUser>`
- Produces: `AuthResolutionEvent<AuthUser>`
- Produces: `reduceAuthResolution(state, event): AuthResolution<AuthUser>`
- Produces: `hasAuthenticatedUser(resolution): resolution is AuthenticatedResolution<AuthUser>`

- [ ] **Step 1: Write table-driven failing transitions**

```js
const cases = [
  ['initial valid session', { status: 'resolving' }, { type: 'SESSION_FOUND', user }, { status: 'authenticated', user }],
  ['initial absent session', { status: 'resolving' }, { type: 'SESSION_ABSENT' }, { status: 'unauthenticated' }],
  ['temporary refresh failure', { status: 'authenticated', user }, { type: 'REFRESH_FAILED', error: temporary }, { status: 'error', error: temporary, previousUser: user }],
]
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @kino/core test`
Expected: FAIL because auth modules are absent.

- [ ] **Step 3: Implement exhaustive reducer**

Use discriminated unions and an `assertNever` unreachable branch. Authoritative invalidation must not retain `previousUser`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @kino/core test`
Expected: transition table passes, including explicit logout and persistent invalidation.

- [ ] **Step 5: Commit**

```text
refactor[auth]: define session resolution state machine

Separate restoration, refresh errors, definitive invalidation, and authenticated state in shared core.
```

### Task 2: Web Auth Adapter

**Files:**
- Create: `apps/web/lib/auth-resolution.ts`
- Create: `apps/web/lib/auth-resolution.test.mjs`
- Modify: `apps/web/stores/auth-store.ts`
- Modify: `apps/web/lib/auth-profile.ts`
- Modify (coordinator): `apps/web/app/providers.tsx`

**Interfaces:**
- Consumes: `reduceAuthResolution`
- Produces store fields: `resolution`, `session`, `profileStatus`
- Preserves existing sign-in/sign-up/sign-out method signatures.

- [ ] **Step 1: Write failing adapter tests**

Test delayed `getSession`, refresh with a previous session, authoritative signed-out events, and initialization idempotency using a complete fake auth source.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @kino/web test`
Expected: FAIL because `createWebAuthResolver` is absent.

- [ ] **Step 3: Implement injected auth-source adapter**

`createWebAuthResolver(source, onResolution)` owns one `getSession` call and one subscription. Keep provider creation in existing web Supabase code, not core.

- [ ] **Step 4: Integrate store without clearing on background refresh**

Profile loading updates `profileStatus` only. Sign-out dispatches definitive unauthenticated.

- [ ] **Step 5: Verify GREEN**

Run: `pnpm --filter @kino/web test && pnpm --filter @kino/web typecheck`
Expected: pass; a delayed session never emits unauthenticated first.

- [ ] **Step 6: Commit**

```text
refactor[web-auth]: preserve sessions during resolution

Expose stable web auth resolution and independent profile readiness without changing Supabase flows.
```

### Task 3: Mobile Auth Adapter

**Files:**
- Create: `apps/mobile/utils/authResolution.ts`
- Create: `apps/mobile/utils/authResolution.test.mjs`
- Modify: `apps/mobile/hooks/auth/useAuth.ts`
- Modify: `apps/mobile/hooks/useAuth.ts`
- Modify: `apps/mobile/utils/authCallback.ts`
- Modify: `apps/mobile/utils/authReturnTo.ts`
- Modify (coordinator): `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: shared auth reducer.
- Produces context values: `resolution`, `profileStatus`, existing auth actions.
- Preserves callback return contract and duplicate-code guard.

- [ ] **Step 1: Write failing mobile tests**

Cover delayed restoration, valid/absent session, app-active refresh failure, duplicate callback, safe internal return path, external return rejection, and authoritative invalidation.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @kino/mobile test`
Expected: FAIL because mobile resolver API is absent.

- [ ] **Step 3: Implement adapter and callback idempotency**

Keep AppState and Expo browser logic platform-local. Temporary refresh errors retain `previousUser`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter @kino/mobile test && pnpm --filter @kino/mobile typecheck`
Expected: all tests pass with no duplicate navigation event.

- [ ] **Step 5: Commit**

```text
refactor[mobile-auth]: gate navigation on session resolution

Preserve restored sessions and idempotent callback destinations across Expo auth flows.
```

### Task 4: Protected Content Gates

**Files:**
- Create: `apps/web/components/protected-content-gate.tsx`
- Create: `apps/web/lib/protected-content-gate.test.mjs`
- Create: `apps/mobile/components/auth/ProtectedContentGate.tsx`
- Create: `apps/mobile/utils/protectedContentState.ts`
- Create: `apps/mobile/utils/protectedContentState.test.mjs`

**Interfaces:**
- Produces `resolveProtectedContentState({ resolution, pageStatus }): 'auth-loading' | 'unauthenticated' | 'page-loading' | 'error' | 'empty' | 'content'`.
- UI gates render platform-specific fallbacks but share priority semantics.

- [ ] **Step 1: Write failing priority tests**

```js
assert.equal(resolveProtectedContentState({
  resolution: { status: 'resolving' },
  pageStatus: 'empty',
}), 'auth-loading')
```

- [ ] **Step 2: Verify RED**

Run both web and mobile tests; expect missing resolver failures.

- [ ] **Step 3: Implement state resolver and thin gates**

Do not fetch inside gates. An `error` with `previousUser` remains authenticated for page access while exposing refresh error metadata.

- [ ] **Step 4: Verify**

Run: `pnpm test && pnpm typecheck`
Expected: all suites pass.

- [ ] **Step 5: Review and commit**

Specification review: verify priority and error semantics.
Quality review: verify no duplicated auth branching in the gate implementations.

```text
feat[auth]: add protected content resolution gates

Provide shared ordering semantics with platform-specific skeleton and unauthenticated fallbacks.
```

## Category Verification

Run focused auth tests, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
Expected: exit 0. Do not migrate every protected screen in this category.

