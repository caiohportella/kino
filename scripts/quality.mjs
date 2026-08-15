import { spawnSync } from 'node:child_process'

const env = {
  ...process.env,

  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ci-build-anon-key',
  NEXT_PUBLIC_TMDB_API_KEY: 'ci-build-tmdb-key',
  NEXT_PUBLIC_SITE_URL: 'https://kino.example.com',

  CI: 'true',
}

const commands = [
  ['pnpm', ['install', '--frozen-lockfile']],
  ['pnpm', ['biome', 'check', '.']],
  ['pnpm', ['lint']],
  ['pnpm', ['typecheck']],
  ['pnpm', ['test']],
  ['pnpm', ['build:web']],
]

for (const [command, args] of commands) {
  console.log(`\n━━━ ${command} ${args.join(' ')} ━━━\n`)

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    console.error(`\n❌ Quality check failed: ${command} ${args.join(' ')}\n`)
    process.exit(result.status ?? 1)
  }
}

console.log('\n✅ All production quality checks passed.\n')
