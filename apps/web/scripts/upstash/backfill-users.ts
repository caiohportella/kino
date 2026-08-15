import { createUserIndexer } from '../../lib/search/upstash/user-indexer.ts'
import { createScriptSupabaseClient, readScriptUpstashConfig } from './shared.ts'

const PAGE_SIZE = 500

async function main() {
  const supabase = createScriptSupabaseClient(process.env)
  const upstash = readScriptUpstashConfig(process.env)
  const indexer = createUserIndexer(upstash)
  let start = 0
  let total = 0

  while (true) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, bio, avatar_url')
      .range(start, start + PAGE_SIZE - 1)
      .order('updated_at', { ascending: false })

    if (error) throw error
    const profiles = (data ?? []) as Array<{
      id: string
      username: string | null
      display_name: string | null
      bio: string | null
      avatar_url: string | null
    }>
    if (profiles.length === 0) break

    await indexer.upsert(
      profiles.map((profile) => ({
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
      }))
    )
    total += profiles.length
    start += profiles.length
    if (profiles.length < PAGE_SIZE) break
  }

  console.info(JSON.stringify({ indexedUsers: total }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
