# Kino

> A modern companion for people who love movies and TV shows.

## Vision

Kino is not another database of movies or a clone of Letterboxd, Trakt, or IMDb.

Its goal is to become the most enjoyable and thoughtfully designed place to track, discover, rate, and remember everything you watch.

The project prioritizes **beautiful UX**, **speed**, **privacy**, and **thoughtful details** over feature quantity.

Every interaction should feel polished, lightweight, and intentional.

---

# Core Philosophy

Kino should feel like:

- Linear
- Raycast
- Vercel
- Apple

...but for cinema.

Minimalist.

Elegant.

Fast.

Without unnecessary clutter.

Every screen should answer a single question as efficiently as possible.

---

# Product Goals

Kino allows users to:

- Track watched movies and TV shows
- Keep a personal viewing diary
- Create watchlists
- Discover new titles
- Rate content
- Follow other users
- Share profiles and watchlists
- View detailed statistics
- Resume TV shows from the correct episode
- See upcoming episodes
- Browse actors and creators
- Share beautiful Open Graph previews

Over time, Kino should become the definitive "watch companion" instead of merely another catalog.

---

# Design Principles

## Simplicity first

Every UI element must justify its existence.

If a feature requires explaining, it is probably too complicated.

---

## Information hierarchy

Important information should always be immediately visible.

Examples:

- poster
- title
- rating
- progress
- next episode

Secondary information should never compete visually.

---

## Motion with purpose

Animations should:

- communicate state
- reinforce hierarchy
- feel smooth

Never animate simply because animation is possible.

Motion should feel subtle, premium, and responsive.

---

## Consistency

The same interaction should behave identically everywhere.

Examples:

- filters
- dialogs
- dropdowns
- cards
- buttons
- page headers
- loading states

Consistency is more important than novelty.

---

## Empty states matter

An empty page is part of the experience.

Instead of saying:

> Nothing here.

Guide the user toward their next action with friendly, cinema-themed illustrations and clear calls to action.

---

## Loading experience

Loading indicators should resemble the final layout.

Prefer skeletons over spinners whenever possible.

Each page should have a skeleton specifically designed for its content.

---

# Technical Philosophy

The codebase values maintainability over cleverness.

Prefer:

- SOLID
- Clean Architecture
- small reusable components
- explicit code
- predictable APIs
- composition over inheritance

Avoid unnecessary abstractions.

---

# Technology

Current stack includes:

- Next.js
- Expo
- React Native
- TypeScript
- TanStack Query
- shadcn/ui
- Base UI
- Tailwind CSS
- TMDB API

---

# User Experience Goals

A user should be able to answer questions like:

- What should I watch next?
- What episode am I on?
- What did I watch last month?
- Which genres do I rate highest?
- What are my friends watching?
- What are the best movies I have never seen?

within seconds.

---

# Performance

Performance is a feature.

The application should:

- feel instant
- minimize layout shifts
- lazy load when appropriate
- avoid unnecessary renders
- cache aggressively
- optimize images
- generate metadata efficiently

---

# Accessibility

Interfaces should be usable by everyone.

Consider:

- keyboard navigation
- screen readers
- contrast
- touch targets
- reduced motion

Accessibility is part of good design, not an afterthought.

---

# Internationalization

Every user-facing string should support localization.

No text should be hardcoded inside components.

Translations should feel natural rather than literal.

---

# Social Experience

Kino is not intended to become another social network.

Social features exist only to enrich discovery.

Examples:

- following users
- shared watchlists
- friends' ratings
- profile sharing

Social mechanics should never overshadow personal tracking.

---

# Open Graph Philosophy

Every page should produce a beautiful preview when shared.

OG images should:

- match the application's branding
- remain minimal
- avoid unnecessary text
- immediately communicate the page content

Every route deserves its own carefully designed identity.

---

# Future Ideas

Potential future directions include:

- recommendations powered by personal history
- AI-assisted movie discovery
- seasonal statistics
- yearly recap
- collaborative watchlists
- cinema calendar
- streaming provider tracking
- advanced filtering
- collections
- achievements
- timeline visualization
- review highlights
- spoiler-safe discussions

---

# Definition of Done

A feature is only complete when it is:

- functional
- responsive
- accessible
- localized
- performant
- visually polished
- consistent with the rest of the application
- tested when appropriate

Shipping quickly should never come at the expense of the overall experience.

---

# What Makes Kino Different

Kino isn't trying to become the platform with the most features.

It aims to become the one people enjoy using the most.

Every decision should support that vision.
