'use client'

import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type UserMetadata = {
  display_name?: unknown
  username?: unknown
}

function getStringMetadata(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function ensureUserProfileFromAuthUser(user: User | null | undefined) {
  if (!user) return

  const metadata = user.user_metadata as UserMetadata
  const username = getStringMetadata(metadata.username)
  const displayName = getStringMetadata(metadata.display_name) || username || user.email?.split('@')[0] || null

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id, display_name, username')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    const updates: { display_name?: string | null; username?: string | null } = {}
    if (!existing.display_name && displayName) updates.display_name = displayName
    if (!existing.username && username) updates.username = username
    if (Object.keys(updates).length > 0) {
      await supabase.from('user_profiles').update(updates).eq('id', user.id)
    }
    return
  }

  await supabase.from('user_profiles').insert({
    id: user.id,
    display_name: displayName,
    username,
  })
}
