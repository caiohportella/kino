import { spawnSync } from 'node:child_process'

function run(label, command, args) {
  console.log(`\n━━━ ${label} ━━━\n`)

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })

  if (result.status !== 0) {
    console.error(`\n❌ ${label} failed.\n`)
    process.exit(result.status ?? 1)
  }
}

run('Biome auto-fix', 'pnpm', ['biome', 'check', '--write', '.'])
run('ESLint auto-fix', 'pnpm', ['exec', 'eslint', '.', '--fix'])

run('Biome', 'pnpm', ['biome', 'check', '.'])
run('Lint', 'pnpm', ['lint'])
run('Typecheck', 'pnpm', ['typecheck'])
run('Tests', 'pnpm', ['test'])
run('Production web build', 'pnpm', ['build:web'])

console.log(`a
✅ Kino quality routine passed.

Formatting and safe lint fixes were applied automatically.
Biome, lint, TypeScript, tests and the production web build all passed.
`)
