# Search and Profile Migration Execution Order and Ownership

## Dependency order

```text
Plan 1: Shared search contracts and ranking
    ↓
Plan 2: Search orchestration and relationship cache
    ↓
Plan 3: Search presentation and consumer migration

Plan 4: Review and responsive title UI
    may run independently after baseline tests pass

Plan 5: Progressive profile query architecture
    ↓
Plan 6: Availability, prefetch, and invalidation

Plans 3, 4, and 6 complete
    ↓
Plan 7: Audit, rollout verification, and legacy cleanup
```

Plans 1 and 5 may begin independently in isolated worktrees. Plan 4 may run independently after baseline tests pass when no coordinator-owned file is being integrated concurrently. Plans 2, 3, 6, and 7 remain blocked by this graph.

Plan 7 cannot remove V1 search compatibility, profile compatibility facades, or other rollback paths until both search consumers and both web/mobile profile implementations pass repository-wide verification. Supported older mobile releases may require retaining V1 beyond Plan 7.

## Coordinator ownership

The primary coordinator exclusively integrates:

- `packages/core/src/search/index.ts`
- `packages/core/src/cache/index.ts`
- `packages/core/src/index.ts`
- root/workspace manifests and `pnpm-lock.yaml`
- shared translation files when multiple plans need them
- `apps/web/app/search/page.tsx`
- `apps/mobile/app/(tabs)/search.tsx`
- `apps/web/components/profile-view.tsx`
- `apps/mobile/app/profile/[id].tsx`
- `apps/mobile/app/(tabs)/profile.tsx`

Domain workers modify focused implementation and test files, then report precise exports and consumer changes for coordinator integration. Shared-file integration occurs only after the producing plan's focused tests pass.

No worker may resolve overlapping-file conflicts by discarding another plan's changes. The coordinator inspects and combines both diffs.

## Search compatibility

Plan 1 adds `SEARCH_SCHEMA_VERSION_V1`, `SEARCH_SCHEMA_VERSION_V2`, `SearchRequestV2`, and `SearchResponseV2` while retaining V1. Plan 2 accepts both versions, returns the requested supported response version, and defaults new clients to V2. Plan 3 migrates web and mobile. Plan 7 removes V1 only if rollback verification and supported-mobile policy permit it.

## Canonical profile identity

Username routing uses `profileQueryKeys.usernameResolution(username)`. After resolution, identity, relationship, content, and availability keys use the immutable canonical profile ID. Username changes therefore do not create duplicate downstream caches.
