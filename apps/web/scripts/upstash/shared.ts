import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TMDbService } from '@kino/core'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  type RedisServerConfig,
  readRedisServerEnv,
  readTmdbServerApiKey,
} from '../../lib/search/server-env.ts'

export interface ScriptSupabaseConfig {
  readonly url: string
  readonly serviceRoleKey: string
}

function parseEnvFile(contents: string) {
  const entries: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const equalsIndex = line.indexOf('=')
    if (equalsIndex === -1) continue
    const key = line.slice(0, equalsIndex).trim()
    if (!key) continue
    let value = line.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    entries[key] = value
  }
  return entries
}

export function loadScriptEnvFromDirectories(
  directories: readonly string[],
  targetEnv: NodeJS.ProcessEnv = process.env
) {
  for (const directory of directories) {
    const envPath = resolve(directory, '.env')
    const localEnvPath = resolve(directory, '.env.local')
    if (existsSync(envPath)) {
      const parsed = parseEnvFile(readFileSync(envPath, 'utf8'))
      for (const [key, value] of Object.entries(parsed)) {
        if (targetEnv[key] === undefined) {
          targetEnv[key] = value
        }
      }
    }
    if (existsSync(localEnvPath)) {
      const parsed = parseEnvFile(readFileSync(localEnvPath, 'utf8'))
      for (const [key, value] of Object.entries(parsed)) {
        if (targetEnv[key] === undefined) {
          targetEnv[key] = value
        }
      }
    }
  }
}

function loadScriptEnv() {
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = dirname(currentFile)

  // apps/web/scripts/upstash/shared.ts
  // ../../../../ => repository root
  const repoRoot = resolve(currentDir, '../../../..')
  const webRoot = resolve(repoRoot, 'apps/web')

  loadScriptEnvFromDirectories([repoRoot, webRoot])
}

loadScriptEnv()

export function readScriptSupabaseConfig(
  env: NodeJS.ProcessEnv = process.env
): ScriptSupabaseConfig {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }
  return { url, serviceRoleKey }
}

export function createScriptSupabaseClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const config = readScriptSupabaseConfig(env)
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function createScriptTmdbService(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = readTmdbServerApiKey(env)
  const publicApiKey =
    env.EXPO_PUBLIC_TMDB_API_KEY ?? env.NEXT_PUBLIC_TMDB_API_KEY ?? env.TMDB_API_KEY
  const resolvedApiKey =
    apiKey ?? (publicApiKey && publicApiKey.trim() === publicApiKey ? publicApiKey : null)
  if (!resolvedApiKey) throw new Error('Missing TMDb API key')
  return new TMDbService(resolvedApiKey)
}

export function readScriptTmdbApiKey(env: NodeJS.ProcessEnv = process.env) {
  const serverApiKey = readTmdbServerApiKey(env)
  if (serverApiKey) return serverApiKey

  const publicApiKey = env.EXPO_PUBLIC_TMDB_API_KEY ?? env.NEXT_PUBLIC_TMDB_API_KEY
  if (publicApiKey && publicApiKey.trim() === publicApiKey) return publicApiKey

  throw new Error('Missing TMDb API key')
}

export function readScriptUpstashConfig(env: NodeJS.ProcessEnv = process.env): RedisServerConfig {
  const config = readRedisServerEnv(env)
  if (!config) {
    throw new Error('Missing Upstash Redis credentials')
  }
  return config
}

export function parseCliArgs(argv: readonly string[]) {
  const flags = new Map<string, string | boolean>()
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, rawValue] = arg.slice(2).split('=', 2)
    if (!key) continue
    flags.set(key, rawValue === undefined ? true : rawValue)
  }
  return flags
}
