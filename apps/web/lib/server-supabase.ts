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
      accept: "application/json",
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return (await response.json()) as T;
}

async function supabaseCount(pathname: string) {
  const { key, url } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${pathname}`, {
    method: "HEAD",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      prefer: "count=exact",
    },
  });
  if (!response.ok) return 0;
  const range = response.headers.get("content-range");
  const count = Number(range?.split("/")[1]);
  return Number.isFinite(count) ? count : 0;
}

function firstRow<T>(data: T | T[] | null) {
  return Array.isArray(data) ? (data[0] ?? null) : data;
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
  const response = await supabaseFetch<PublicProfileOgRow | PublicProfileOgRow[]>(
    "rpc/get_public_profile_og_data",
    { method: "POST", body: JSON.stringify({ profile_username: username }) },
  );
  const data = firstRow(response);
  if (!data) return getPublicProfileOgDataFallback(username);

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

async function getPublicProfileOgDataFallback(username: string) {
  const encodedUsername = encodeURIComponent(username);
  const response = await supabaseFetch<Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  }>>(
    `user_profiles?select=id,username,display_name,avatar_url,bio&username=ilike.${encodedUsername}&limit=1`,
  );
  const profile = firstRow(response);
  if (!profile) return null;

  const userId = encodeURIComponent(profile.id);
  const [movieRatings, episodesWatched, diaryEntries] = await Promise.all([
    supabaseCount(`title_ratings?select=id&user_id=eq.${userId}&rating=gt.0`),
    supabaseCount(`episode_ratings?select=id&user_id=eq.${userId}`),
    supabaseCount(`watch_diary?select=id&user_id=eq.${userId}`),
  ]);

  return {
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    diaryEntries,
    displayName: profile.display_name || profile.username || "Kino member",
    episodesWatched,
    movieRatings,
    username: profile.username,
  };
}

export type PublicProfileOgData = NonNullable<
  Awaited<ReturnType<typeof getPublicProfileOgDataByUsername>>
>;

export async function getPublicProfileOgData(
  id: string,
): Promise<PublicProfileOgData | null> {
  const response = await supabaseFetch<Array<{ username: string | null }>>(
    `user_profiles?select=username&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  const data = firstRow(response);
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
  const response = await supabaseFetch<Array<{
    name: string;
    description: string | null;
    is_shared: boolean;
  }>>(
    `watchlists?select=name,description,is_shared&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  const data = firstRow(response);
  if (!data || !data.is_shared) return null;
  return {
    name: data.name as string,
    description: data.description as string | null,
    titles: [],
    participants: [],
  } satisfies PublicWatchlistOgData;
}
