import type { SupabaseClient } from '@supabase/supabase-js'
import { readRedisServerEnv } from '../server-env.ts'
import { createUserIndexer } from './user-indexer.ts'

function createOptionalUserIndexer() {
  const config = readRedisServerEnv()
  return config ? createUserIndexer(config) : null
}

export async function upsertUserSearchProfile(supabase: SupabaseClient, userId: string) {
  const indexer = createOptionalUserIndexer()
  if (!indexer) return

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, bio, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    await indexer.deleteUser(userId)
    return
  }

  await indexer.upsert({
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    avatarUrl: data.avatar_url,
  })
}

export async function deleteUserSearchProfile(userId: string) {
  const indexer = createOptionalUserIndexer()
  if (!indexer) return
  await indexer.deleteUser(userId)
}
