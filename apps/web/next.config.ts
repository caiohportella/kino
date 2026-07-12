import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) return {}

  const env: Record<string, string> = {}
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (key) env[key] = value
  }
  return env
}

function findWorkspaceRoot() {
  const cwd = process.cwd()
  if (existsSync(resolve(cwd, 'pnpm-workspace.yaml'))) return cwd

  const parentWorkspaceRoot = resolve(cwd, '..', '..')
  if (existsSync(resolve(parentWorkspaceRoot, 'pnpm-workspace.yaml'))) return parentWorkspaceRoot

  return cwd
}

const workspaceRoot = findWorkspaceRoot()
const rootEnv = readEnvFile(resolve(workspaceRoot, '.env'))

for (const [key, value] of Object.entries(rootEnv)) {
  process.env[key] ??= value
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = rootEnv[name] ?? process.env[name]
    if (value) return value
  }
  return undefined
}

function createNextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: envValue('NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL'),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: envValue(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'EXPO_PUBLIC_SUPABASE_ANON_KEY'
      ),
      NEXT_PUBLIC_TMDB_API_KEY: envValue('NEXT_PUBLIC_TMDB_API_KEY', 'EXPO_PUBLIC_TMDB_API_KEY'),
      NEXT_PUBLIC_SITE_URL: envValue('NEXT_PUBLIC_SITE_URL', 'EXPO_PUBLIC_WEB_URL'),
      NEXT_PUBLIC_AUTH_REDIRECT_URL: envValue(
        'NEXT_PUBLIC_AUTH_REDIRECT_URL',
        'EXPO_PUBLIC_AUTH_REDIRECT_URL'
      ),
      NEXT_PUBLIC_VERCEL_URL: envValue('NEXT_PUBLIC_VERCEL_URL', 'VERCEL_URL'),
      NEXT_PUBLIC_APP_SCHEME:
        envValue('NEXT_PUBLIC_APP_SCHEME', 'EXPO_PUBLIC_APP_SCHEME') ?? 'kino',
      NEXT_PUBLIC_UPSTASH_VECTOR_REST_URL: envValue(
        'NEXT_PUBLIC_UPSTASH_VECTOR_REST_URL',
        'EXPO_PUBLIC_UPSTASH_VECTOR_REST_URL'
      ),
      NEXT_PUBLIC_UPSTASH_VECTOR_REST_TOKEN: envValue(
        'NEXT_PUBLIC_UPSTASH_VECTOR_REST_TOKEN',
        'EXPO_PUBLIC_UPSTASH_VECTOR_REST_TOKEN'
      ),
    },
    transpilePackages: ['@kino/core', '@kino/ui'],
  }
}

export default createNextConfig
