import { createClient } from '@supabase/supabase-js'

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing public Supabase configuration')
  return { key, url: url.replace(/\/+$/, '') }
}

function createPublicSupabaseClient() {
  const { key, url } = supabaseConfig()
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function supabaseFetch<T>(pathname: string, init?: RequestInit) {
  const { key, url } = supabaseConfig()
  const response = await fetch(`${url}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      accept: 'application/json',
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const details = await response
      .json()
      .then((body: { code?: unknown }) => (typeof body.code === 'string' ? `, ${body.code}` : ''))
      .catch(() => '')
    throw new Error(`Supabase request failed (${response.status}${details})`)
  }
  return (await response.json()) as T
}

function firstRow<T>(data: T | T[] | null) {
  return Array.isArray(data) ? (data[0] ?? null) : data
}

export async function getPublicProfileOgDataByUsername(username: string) {
  const client = createPublicSupabaseClient()
  const { data: response, error } = await client.rpc('get_public_profile_og_data', {
    profile_username: username,
  })
  if (error) return getPublicProfileOgDataFallback(username)
  const data = firstRow(response)
  if (!data) return getPublicProfileOgDataFallback(username)

  if (data.movies_watched == null || data.series_watched == null) {
    try {
      const fallback = await getPublicProfileOgDataFallback(username)
      if (fallback) return fallback
    } catch (error) {
      console.warn('[profile-og-data] legacy RPC aggregate fallback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'legacy-rpc-aggregate',
        username,
      })
    }
  }

  return {
    avatarUrl: data.avatar_url as string | null,
    bannerUrl: data.banner_url as string | null,
    bio: data.bio as string | null,
    diaryEntries: Number(data.diary_entries) || 0,
    displayName: (data.display_name || data.username || 'Kino member') as string,
    moviesWatched: toSafeCount(data.movies_watched ?? data.movie_ratings ?? 0),
    seriesWatched: toSafeCount(data.series_watched ?? data.episodes_watched ?? 0),
    username: data.username as string | null,
  }
}

async function getPublicProfileOgDataFallback(username: string) {
  const client = createPublicSupabaseClient()
  const { data: profile, error } = await client
    .from('user_profiles')
    .select('id,username,display_name,avatar_url,banner_url,bio')
    .ilike('username', username)
    .maybeSingle()
  if (error) throw error
  if (!profile) return null

  return {
    avatarUrl: profile.avatar_url,
    bannerUrl: profile.banner_url,
    bio: profile.bio,
    diaryEntries: 0,
    displayName: profile.display_name || profile.username || 'Kino member',
    moviesWatched: 0,
    seriesWatched: 0,
    username: profile.username,
  }
}

function toSafeCount(value: number | string | null) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? count : 0
}

export type PublicProfileOgData = NonNullable<
  Awaited<ReturnType<typeof getPublicProfileOgDataByUsername>>
>

export async function getPublicProfileOgData(id: string): Promise<PublicProfileOgData | null> {
  const response = await supabaseFetch<Array<{ username: string | null }>>(
    `user_profiles?select=username&id=eq.${encodeURIComponent(id)}&limit=1`
  )
  const data = firstRow(response)
  if (!data?.username) return null
  return getPublicProfileOgDataByUsername(data.username)
}

export interface PublicWatchlistOgData {
  id: string
  name: string
  description: string | null
  owner: {
    displayName: string
    username: string | null
    avatarUrl: string | null
  }
  titleCount: number
  titles: Array<{
    title: string
    cover_image: string | null
    backdrop_image: string | null
  }>
  participants: Array<{
    displayName: string
    avatarUrl: string | null
  }>
}

export async function getPublicWatchlistOgData(id: string): Promise<PublicWatchlistOgData | null> {
  const client = createPublicSupabaseClient()
  const { data, error } = await client
    .from('watchlists')
    .select('id,name,description,user_id,visibility')
    .eq('id', id)
    .eq('visibility', 'public')
    .maybeSingle()
  if (error || !data) return null
  const [{ data: owner }, { data: items, error: itemsError }] = await Promise.all([
    client
      .from('user_profiles')
      .select('username,display_name,avatar_url')
      .eq('id', data.user_id)
      .maybeSingle(),
    client
      .from('watchlist_items')
      .select('id,title:titles(title,cover_image,backdrop_image)')
      .eq('watchlist_id', id)
      .order('added_at', { ascending: false })
      .order('id', { ascending: true }),
  ])
  if (itemsError) throw itemsError
  const titles = (items ?? []).flatMap((item) => {
    const title = item.title as unknown as PublicWatchlistOgData['titles'][number] | null
    return title ? [title] : []
  })
  const displayName = owner?.display_name || owner?.username || 'Kino member'
  return {
    id: data.id,
    name: data.name as string,
    description: data.description as string | null,
    owner: { avatarUrl: owner?.avatar_url ?? null, displayName, username: owner?.username ?? null },
    titleCount: titles.length,
    titles,
    participants: [{ avatarUrl: owner?.avatar_url ?? null, displayName }],
  } satisfies PublicWatchlistOgData
}
