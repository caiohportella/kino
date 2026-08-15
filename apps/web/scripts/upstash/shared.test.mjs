import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  loadScriptEnvFromDirectories,
  readScriptSupabaseConfig,
  readScriptTmdbApiKey,
} from './shared.ts'

test('prefers server TMDb key and falls back to public TMDb key for scripts', () => {
  assert.equal(
    readScriptTmdbApiKey({
      TMDB_API_KEY: 'server-key',
      EXPO_PUBLIC_TMDB_API_KEY: 'public-key',
    }),
    'server-key'
  )
  assert.equal(
    readScriptTmdbApiKey({
      EXPO_PUBLIC_TMDB_API_KEY: 'public-key',
    }),
    'public-key'
  )
})

test('loads env files from a configured directory list', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'kino-upstash-env-'))
  writeFileSync(
    join(tempDir, '.env'),
    'TMDB_API_KEY=from-file\nUPSTASH_VECTOR_REST_URL=https://example.com\n'
  )
  const env = {}

  loadScriptEnvFromDirectories([tempDir], env)

  assert.equal(env.TMDB_API_KEY, 'from-file')
  assert.equal(env.UPSTASH_VECTOR_REST_URL, 'https://example.com')
})

test('accepts Expo Supabase URL for admin scripts', () => {
  assert.deepEqual(
    readScriptSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    }),
    {
      url: 'https://example.supabase.co',
      serviceRoleKey: 'service-role',
    }
  )
})
