import { createUserIndexer } from '../../lib/search/upstash/user-indexer.ts'
import { createScriptSupabaseClient, parseCliArgs, readScriptUpstashConfig } from './shared.ts'

function userIdFromArg(value: string | boolean | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) throw new Error('Missing or invalid --userId')
  return raw
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const supabase = createScriptSupabaseClient(process.env)
  const upstash = readScriptUpstashConfig(process.env)
  const indexer = createUserIndexer(upstash)
  const userId = userIdFromArg(args.get('userId'))

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, bio, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`User profile not found: ${userId}`)

  await indexer.upsert({
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    avatarUrl: data.avatar_url,
  })

  console.info(JSON.stringify({ userId, indexed: true }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
