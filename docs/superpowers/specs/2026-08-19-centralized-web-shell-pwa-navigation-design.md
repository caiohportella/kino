# Centralized Web Shell and PWA Navigation Design

## Goal

Restore Kino's focused desktop/tablet application shell and make installed PWA navigation intentionally app-like: a shared centered content boundary in browser mode, no top navbar in standalone mode, and a profile avatar destination in the PWA bottom nav.

## Constraints

- The `1320px` design boundary must be defined once in a shared container primitive or class. Components must consume that primitive rather than repeat the numeric value.
- The shared container owns horizontal padding. Page content must not add a second shell-level horizontal padding layer.
- The top navbar background and border may span the viewport, but its content must use the same shared container as page content.
- Standalone mode is authoritative for PWA navigation configuration. Ordinary mobile browser mode keeps the existing top-nav/mobile behavior and does not receive the PWA-only bottom navigation configuration.
- Standalone detection must support `display-mode: standalone` and iOS `navigator.standalone`, while avoiding a browser-navbar flash or layout jump during hydration.
- Profile-route matching must be a reusable helper that distinguishes the authenticated user's profile section from other users' profiles.
- Existing authentication, profile, avatar, route, translation, and safe-area conventions must be reused.

## Existing architecture

`apps/web/components/layout/app-shell.tsx` owns the application chrome and currently renders the top header, `page-main`, footer, and `MobileBottomNav`. `apps/web/app/globals.css` contains the current shell geometry, but `.content-frame` is full width and the header's existing `.app-header-inner` rule is not used by the JSX. `apps/web/components/layout/account-menu.tsx` already resolves the authenticated profile and renders the existing avatar component. No standalone-mode helper currently exists, so detection belongs at the shell boundary.

## Proposed architecture

### Shared container

Create one shell-level `AppContainer` primitive in `apps/web/components/layout/app-container.tsx`. It will provide the single `1320px` max-width boundary and responsive horizontal padding. The primitive should support the existing `className` composition pattern without exposing separate width rules to each consumer.

Use `AppContainer` for:

- top-navbar content;
- `page-main` content;
- footer content where alignment is expected.

Keep `.page-main` responsible only for vertical spacing, flex sizing, and bottom-nav compensation. The container owns the horizontal geometry.

### Standalone mode

Create a single client-side `useStandaloneMode` hook, or an equivalent shell-owned state abstraction, in `apps/web/hooks/`. It should initialize to a hydration-safe state that does not cause a visible browser-navbar-then-remove transition, subscribe to `matchMedia('(display-mode: standalone)')`, and include the iOS standalone fallback. The hook is consumed by `AppShell`; unrelated pages and components do not perform standalone checks.

`AppShell` will derive navigation geometry from that state:

- browser mode: render the existing top navbar and browser-responsive behavior;
- standalone mode: omit the top navbar element entirely, remove its height/offset effects, and render the bottom PWA nav for authenticated users;
- authenticated bottom-nav content padding is applied only when the bottom nav is actually present.

The CSS must not reserve top-navbar space in standalone mode. Sticky title/sidebar offsets that depend on `--app-header-height` must be guarded by the same shell state or a shell class so standalone mode has no hidden header offset.

### Bottom navigation and profile section

Add `isProfileSectionPath(pathname, username)` to a reusable route helper module. It should return true for the authenticated user's canonical profile route and descendant profile routes such as `/username/stats` and `/username/stats/recap/...`, and false for another user's equivalent route. Matching must use the existing username normalization/canonical route behavior.

The bottom nav will add a sixth profile destination only in the standalone PWA configuration. It will reuse the avatar/profile query source and `Avatar` components already used by the account menu, falling back to the existing profile/user icon when no avatar URL exists. The link will have an accessible label and route directly to the authenticated user's canonical profile path. Profile, stats, monthly/lifetime recap, and other profile-owned routes use the helper for selected-state treatment.

The bottom-nav grid changes from a fixed five-column assumption to an even, non-overflowing layout that accommodates the profile item, maintains current selected-state styling, and retains `env(safe-area-inset-bottom)` handling.

## Data flow

1. `AppShell` reads auth state and profile information through existing stores/query services.
2. `useStandaloneMode` resolves the environment once at the shell boundary.
3. `AppShell` assigns shell state/classes and decides whether top or bottom navigation exists.
4. `AppContainer` supplies the shared horizontal boundary to nav/page/footer consumers.
5. `MobileBottomNav` receives the authenticated profile identity/avatar data and uses `isProfileSectionPath` for active state.

## Error and loading behavior

- If profile data is still loading, render the profile destination with the fallback avatar/icon and keep the route disabled only when no canonical username is available.
- Anonymous users must not receive a profile destination or authenticated bottom-nav padding.
- Auth callback, landing, and auth-resolution loading routes retain their current bare/loading behavior.
- Standalone detection must be client-safe and must not read `window` or `navigator` during server rendering.

## Verification requirements

Add focused tests for:

- standalone detection behavior for display-mode and iOS standalone environments;
- profile-section matching and cross-user exclusion;
- bottom-nav profile avatar/fallback semantics and accessible navigation;
- shared container usage/alignment and absence of duplicate shell padding.

Run the existing web quality workflow, web tests, typecheck, lint, and production build. Inspect the resulting diff to ensure unrelated in-progress work is untouched.
