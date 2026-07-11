import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let publicClient: SupabaseClient | null = null

function getPublicClient() {
  if (publicClient) return publicClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  publicClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
  return publicClient
}

export interface PublicProfileOgData {
  avatarUrl: string | null
  bio: string | null
  displayName: string
  username: string | null
  movieRatings: number
  episodesWatched: number
  diaryEntries: number
}

export async function getPublicProfileOgData(id: string): Promise<PublicProfileOgData | null> {
  const client = getPublicClient()
  if (!client || !isUuid(id)) return null

  const { data: profile, error } = await client
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, bio')
    .eq('id', id)
    .maybeSingle()
  if (error || !profile) return null

  const [movies, series, diary] = await Promise.all([
    client.from('title_ratings').select('id', { count: 'exact', head: true }).eq('user_id', id),
    client.from('episode_ratings').select('title_id', { count: 'exact', head: true }).eq('user_id', id),
    client.from('watch_diary').select('id', { count: 'exact', head: true }).eq('user_id', id),
  ])

  return {
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    displayName: profile.display_name || profile.username || 'Kino member',
    username: profile.username,
    movieRatings: movies.count || 0,
    episodesWatched: series.count || 0,
    diaryEntries: diary.count || 0,
  }
}

interface WatchlistTitleRow {
  backdrop_image: string | null
  cover_image: string | null
  title: string
}

export interface PublicWatchlistOgData {
  name: string
  description: string | null
  titles: WatchlistTitleRow[]
  participants: Array<{
    avatarUrl: string | null
    displayName: string
  }>
}

export async function getPublicWatchlistOgData(id: string): Promise<PublicWatchlistOgData | null> {
  const client = getPublicClient()
  if (!client || !isUuid(id)) return null

  const { data: watchlist, error } = await client
    .from('watchlists')
    .select('id, user_id, name, description, is_shared')
    .eq('id', id)
    .eq('is_shared', true)
    .maybeSingle()
  if (error || !watchlist) return null

  const [{ data: itemRows }, { data: collaboratorRows }] = await Promise.all([
    client
      .from('watchlist_items')
      .select('added_by, title:titles(title, cover_image, backdrop_image)')
      .eq('watchlist_id', id)
      .order('added_at', { ascending: false })
      .limit(8),
    client.from('watchlist_collaborators').select('user_id').eq('watchlist_id', id),
  ])

  const participantIds = [
    watchlist.user_id,
    ...((collaboratorRows || []) as Array<{ user_id: string }>).map((row) => row.user_id),
  ]
  const uniqueParticipantIds = [...new Set(participantIds)]
  const { data: profiles } =
    uniqueParticipantIds.length > 0
      ? await client
          .from('user_profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', uniqueParticipantIds)
      : { data: [] }

  const titles = (itemRows || [])
    .map((row) => {
      const title = Array.isArray(row.title) ? row.title[0] : row.title
      return title as WatchlistTitleRow | null
    })
    .filter((title): title is WatchlistTitleRow => Boolean(title))

  return {
    name: watchlist.name,
    description: watchlist.description,
    titles,
    participants: (profiles || []).map((profile) => ({
      avatarUrl: profile.avatar_url,
      displayName: profile.display_name || profile.username || 'Kino member',
    })),
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}
