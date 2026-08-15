'use client'

import type { User } from '@supabase/supabase-js'
import { type AuthProfileStatus, createAuthProfileEnsurer } from '@/lib/auth-profile-resolution'
import { syncCurrentUserSearchProfile } from '@/lib/search/upstash/user-sync-client'
import { supabase } from '@/lib/supabase/client'

export type { AuthProfileStatus } from '@/lib/auth-profile-resolution'

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

export async function ensureUserProfileFromAuthUser(
  user: User | null | undefined,
  onStatus?: (status: AuthProfileStatus) => void
) {
  if (!user) {
    onStatus?.('idle')
    return
  }

  await ensureUserProfile(user, onStatus)
  await syncCurrentUserSearchProfile('upsert').catch(() => undefined)
}
