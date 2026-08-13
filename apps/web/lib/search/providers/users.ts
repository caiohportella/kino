import type { UserProfile } from '@kino/core'
import type { SupabaseClient } from '@supabase/supabase-js'

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/gu, '\\$&').replaceAll("'", "''")
}

export function createSupabaseUserSearchFallback(supabase: SupabaseClient) {
  return async function searchUsersFallback(
    query: string,
    _signal?: AbortSignal
  ): Promise<readonly UserProfile[]> {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []

    const pattern = `%${escapeLikePattern(trimmed)}%`
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio')
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(20)

    if (error) throw error
    return (data ?? []) as UserProfile[]
  }
}
