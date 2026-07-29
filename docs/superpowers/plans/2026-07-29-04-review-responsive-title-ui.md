# Review and Responsive Title UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct review width, create a two-card profile review carousel, and align mobile title identity/actions without changing desktop title layout.

**Architecture:** Reuse current review cards, row controls, and title markup; change responsive geometry and section-state composition only.

**Tech Stack:** React, Tailwind CSS, React Native styles, accessibility tests.

## Global Constraints

- Preserve review actions, links, sorting, and full title-page text.
- Native focus order wins over row-level arrow scrolling.
- Full-width mobile behavior belongs to the outer interactive wrapper.
- This plan may run independently after baseline tests pass, subject to coordinator ownership and overlap rules.

---

### Task 1: Title review width

**Files:**
- Modify: `apps/web/components/reviews/review-card.tsx`
- Modify: `apps/mobile/components/reviews/ReviewCard.tsx`
- Test: `apps/web/lib/review-card-contract.test.mjs`
- Create: `apps/mobile/utils/reviewCardLayout.test.mjs`

- [ ] Add failing assertions for bounded avatar plus `minmax(0,1fr)`, full content-column body, safe wrapping, and narrow header-action wrapping.
- [ ] Run focused tests; expect FAIL.
- [ ] Apply grid/flex changes without a narrow review-body maximum width.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `fix(reviews): expand title review body width`

### Task 2: Profile review carousel states and geometry

**Files:**
- Modify: `apps/web/components/reviews/profile-reviews-section.tsx`
- Modify: `apps/web/components/reviews/profile-review-card.tsx`
- Modify: `apps/web/components/reviews/profile-review-skeleton.tsx`
- Modify: `apps/web/components/profile-view.tsx` only for shared row extraction/props.
- Create: `apps/web/components/profile-horizontal-row.tsx` if extraction is required.
- Modify: `packages/core/src/reviews.ts`
- Test: `packages/core/src/reviews.test.mjs`
- Test: `apps/web/lib/profile-reviews-section.test.mjs`
- Test: `apps/web/lib/profile-review-card.test.mjs`
- Create: `apps/web/lib/profile-review-carousel.test.mjs`

- [ ] Add failing tests for deterministic timestamp/ID ordering, exactly two desktop cards using shared gap geometry, mobile preview, independent nested actions, two-card skeleton, pending/error versus empty, retained refresh, and scroll-position preservation.
- [ ] Run focused review tests; expect FAIL.
- [ ] Reuse/extract the watched-title row controls and geometry; guard arrow handling when the target is interactive/editable.
- [ ] Run focused tests and automated accessibility checks; expect PASS.
- [ ] Commit: `feat(profile): scroll two review cards at a time`

### Task 3: Mobile title identity and action widths

**Files:**
- Modify: `apps/web/app/title/[id]/page.tsx`
- Modify: `apps/mobile/app/title/[id].tsx`
- Create: `apps/web/lib/title-responsive-layout.test.mjs`
- Create: `apps/mobile/utils/titleResponsiveLayout.test.mjs`

- [ ] Add failing responsive assertions for centered identity only, desktop left alignment, left-aligned long content, missing metadata, wrapped genres, and full-width Buy Tickets/link wrappers. Use component behavior and computed geometry; capture screenshots or DOM measurements when infrastructure exists.
- [ ] Run focused tests; expect FAIL.
- [ ] Apply responsive classes/styles to existing markup without duplicating the hero.
- [ ] Run focused tests and verify provider URL behavior; expect PASS.
- [ ] Review gate and rollback: compare desktop title contracts and review mutations before removing no legacy markup. Each task is independently revertible.
- [ ] Commit: `fix(title): align mobile identity and actions`
