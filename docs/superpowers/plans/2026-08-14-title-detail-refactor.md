# Kino Title Detail Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Kino's movie and TV title pages into a continuous detail layout with a unified sidebar and no redundant structural cards.

**Architecture:** Keep existing title data flow and component boundaries. Add one shared `TitleSection` primitive, extend existing shared components with embedded/flat variants, and compose recommendations below the main two-column area. Change presentation wrappers only.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Kino UI primitives, TanStack Query, Tolgee.

## Global Constraints

- The current local repository is the source of truth.
- Do not modify title fetching, TMDb behavior, ratings calculations, diary persistence, review mutations, episode logic, routes, or localization architecture.
- Preserve standalone variants of shared components.
- Do not add hard-coded user-facing English strings.
- Preserve responsive behavior from 320px upward, keyboard focus, semantic headings, dialogs, external-link accessibility, loading/error/empty states, and reduced-motion behavior.
- Limit source changes to the title-detail components and the new structural primitive.

---

### Task 1: Add shared title-section composition

**Files:** `apps/web/components/title/title-section.tsx`, `apps/web/components/title/title-page.tsx`

- [ ] Add `TitleSection({ children, className, title })` with Kino tokens and `cn`.
- [ ] Use it for synopsis/activity, TV seasons, community, discovery, and the below-grid recommendation shelf.
- [ ] Keep hero, sidebar widths, sticky offset, action props, and title data flow unchanged.

### Task 2: Flatten metadata and discovery sections

**Files:** `apps/web/components/title/title-metadata.tsx`, `apps/web/components/title/title-context.tsx`, `apps/web/components/reviews/reviews-section.tsx`

- [ ] Remove synopsis and personal-rating structural cards while preserving rating/delete/auth behavior.
- [ ] Add embedded community, franchise, and recommendation presentations while retaining standalone behavior.
- [ ] Keep individual review cards and all composer/dialog/mutation/auth behavior; remove only section-level card treatment.
- [ ] Compose recommendations below the two-column layout.

### Task 3: Finish the unified sidebar

**Files:** `apps/web/components/title/title-sidebar.tsx`, `apps/web/components/title/title-context.tsx`, `apps/web/components/external-links-section.tsx`

- [ ] Keep the sidebar as the sole outer surface and omit empty credits spacing.
- [ ] Preserve standalone card/tile paths, provider routing, labels, brand tints, focus rings, and narrow-width wrapping.

### Task 4: Make TV seasons continuous

**File:** `apps/web/components/title/title-seasons.tsx`

- [ ] Remove the season header's permanent rounded border/background surface.
- [ ] Replace per-episode border/background/card styling with separated rows using `border-t`, row padding, and subtle hover treatment.
- [ ] Preserve thumbnail layout, metadata, watched/unaired behavior, queries, mutations, and dialogs.

### Task 5: Verify

- [ ] Format only touched files.
- [ ] Run web typecheck, lint/quality, and relevant title/review tests using existing pnpm scripts.
- [ ] Review `git diff --stat`, `git diff --name-only`, and `git status --short`; confirm unrelated dirty changes remain untouched.
