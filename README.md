# Kino

Kino is a movie and series tracking app. This repo now contains the existing Expo/React Native app plus a Next.js PWA port in a pnpm monorepo.

## Workspace

```text
apps/
  mobile/       Expo Router React Native app
  web/          Next.js App Router PWA
packages/
  core/         Domain types, TMDB, Supabase adapter, import parser, use cases
  ui/           Reusable web UI primitives
  config/       Shared TypeScript config
```

Database schema and migrations remain in `database/` at the workspace root.

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create one root `.env` file:

```bash
cp .env.example .env
```

Use the `EXPO_PUBLIC_*` names in the root `.env`. The Expo app reads them directly, and the Next.js app maps them to its `NEXT_PUBLIC_*` names at startup.

Required public client values:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_TMDB_API_KEY=
EXPO_PUBLIC_UPSTASH_VECTOR_REST_URL=
EXPO_PUBLIC_UPSTASH_VECTOR_REST_TOKEN=
EXPO_PUBLIC_WEB_URL=https://kino.vercel.app
EXPO_PUBLIC_AUTH_REDIRECT_URL=https://kino.vercel.app/auth/callback
EXPO_PUBLIC_APP_SCHEME=kino
```

3. In Supabase Auth URL Configuration, allow the web callback URL you use locally:
   `http://localhost:3000/auth/callback`. Production should allow
   `https://kino.vercel.app/auth/callback`.

4. Start the app you want to work on:

```bash
pnpm dev:web
pnpm dev:mobile
```

The web app runs with Next.js and uses the same Supabase and TMDB services as the mobile app.

## Scripts

```bash
pnpm dev          # start apps/web
pnpm dev:web      # start apps/web
pnpm dev:mobile   # start apps/mobile
pnpm build        # build apps/web
pnpm build:web    # build apps/web
pnpm typecheck    # typecheck all workspace packages that expose the script
pnpm lint         # run package lint scripts
pnpm start        # start apps/mobile
pnpm mobile:web   # start Expo web for apps/mobile
pnpm native:prebuild # run Expo prebuild for native targets
```

## Notes

See `WEB_MIGRATION_NOTES.md` for the migration inventory, mobile-to-web adaptations, and the product-domain mismatch in the pasted brief.
