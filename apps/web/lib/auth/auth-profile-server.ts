import type { User } from '@supabase/supabase-js'
import { createAuthProfileEnsurer } from '@/lib/auth/auth-profile-resolution'
import { upsertUserSearchProfile } from '@/lib/search/upstash/user-sync'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function ensureServerUserProfile(user: User) {
  const supabase = await createServerSupabaseClient()

  const ensureUserProfile = createAuthProfileEnsurer({
    read: async (userId) =>
      supabase
        .from('user_profiles')
        .select('id, display_name, username')
        .eq('id', userId)
        .maybeSingle(),

    update: async (userId, updates) =>
      supabase.from('user_profiles').update(updates).eq('id', userId),

    insert: async (profile) => supabase.from('user_profiles').insert(profile),
  })

  await ensureUserProfile(user)
  await upsertUserSearchProfile(supabase, user.id)
}
