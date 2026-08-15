import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  CI: "true",

  // Match GitHub CI.
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "ci-build-anon-key",
  NEXT_PUBLIC_TMDB_API_KEY: "ci-build-tmdb-key",
  NEXT_PUBLIC_SITE_URL: "https://kino.example.com",
};

function run(label, command, args) {
  console.log(`\n━━━ ${label} ━━━\n`);

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`\n❌ ${label} failed.\n`);
    process.exit(result.status ?? 1);
  }
}

//
// AUTO-FIX — WEB ONLY
//

run("Biome auto-fix", "pnpm", [
  "exec",
  "biome",
  "check",
  "--write",
  "apps/web",
]);

//
// VERIFY
//

run("Biome check", "pnpm", ["exec", "biome", "check", "apps/web"]);

run("Lint", "pnpm", ["--filter", "./apps/web", "lint"]);

run("Typecheck", "pnpm", ["--filter", "./apps/web", "typecheck"]);

run("Tests", "pnpm", ["--filter", "./apps/web", "test"]);

run("Production web build", "pnpm", ["build:web"]);

console.log(`
✅ Kino web quality routine passed.

Auto-fixed:
  • formatting
  • import ordering
  • safe Biome fixes
  • ESLint auto-fixes

Verified:
  • Biome
  • lint
  • TypeScript
  • tests
  • production web build
`);
