import { createClient } from "@supabase/supabase-js";

function serverClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing-anon-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface PublicProfileOgRow {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  movie_ratings: number | string | null;
  episodes_watched: number | string | null;
  diary_entries: number | string | null;
}

export async function getPublicProfileOgDataByUsername(username: string) {
  const client = serverClient();
  const { data, error } = await client
    .rpc("get_public_profile_og_data", { profile_username: username })
    .returns<PublicProfileOgRow[]>()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    avatarUrl: data.avatar_url as string | null,
    bio: data.bio as string | null,
    diaryEntries: Number(data.diary_entries) || 0,
    displayName: (data.display_name ||
      data.username ||
      "Kino member") as string,
    episodesWatched: Number(data.episodes_watched) || 0,
    movieRatings: Number(data.movie_ratings) || 0,
    username: data.username as string | null,
  };
}

export type PublicProfileOgData = NonNullable<
  Awaited<ReturnType<typeof getPublicProfileOgDataByUsername>>
>;

export async function getPublicProfileOgData(
  id: string,
): Promise<PublicProfileOgData | null> {
  const { data, error } = await serverClient()
    .from("user_profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.username) return null;
  return getPublicProfileOgDataByUsername(data.username);
}

export interface PublicWatchlistOgData {
  name: string;
  description: string | null;
  titles: Array<{
    title: string;
    cover_image: string | null;
    backdrop_image: string | null;
  }>;
  participants: Array<{
    displayName: string;
    avatarUrl: string | null;
  }>;
}

export async function getPublicWatchlistOgData(
  id: string,
): Promise<PublicWatchlistOgData | null> {
  const { data } = await serverClient()
    .from("watchlists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.is_shared) return null;
  return {
    name: data.name as string,
    description: data.description as string | null,
    titles: [],
    participants: [],
  } satisfies PublicWatchlistOgData;
}
