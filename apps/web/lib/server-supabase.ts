function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing public Supabase configuration");
  return { key, url: url.replace(/\/+$/, "") };
}

async function supabaseFetch<T>(pathname: string, init?: RequestInit) {
  const { key, url } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      accept: "application/vnd.pgrst.object+json",
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 406 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return (await response.json()) as T;
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
  const data = await supabaseFetch<PublicProfileOgRow>(
    "rpc/get_public_profile_og_data",
    { method: "POST", body: JSON.stringify({ profile_username: username }) },
  );
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
  const data = await supabaseFetch<{ username: string | null }>(
    `user_profiles?select=username&id=eq.${encodeURIComponent(id)}`,
  );
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
  const data = await supabaseFetch<{
    name: string;
    description: string | null;
    is_shared: boolean;
  }>(
    `watchlists?select=name,description,is_shared&id=eq.${encodeURIComponent(id)}`,
  );
  if (!data || !data.is_shared) return null;
  return {
    name: data.name as string,
    description: data.description as string | null,
    titles: [],
    participants: [],
  } satisfies PublicWatchlistOgData;
}
