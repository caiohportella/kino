import { createClient } from "@supabase/supabase-js";

function supabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
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

  if (!response.ok) {
    const details = await response
      .json()
      .then((body: { code?: unknown }) =>
        typeof body.code === "string" ? `, ${body.code}` : "",
      )
      .catch(() => "");
    throw new Error(`Supabase request failed (${response.status}${details})`);
  }
  return (await response.json()) as T;
}

function firstRow<T>(data: T | T[] | null) {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

interface PublicProfileOgRow {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  movies_watched: number | string | null;
  series_watched: number | string | null;
  diary_entries: number | string | null;
  movie_ratings?: number | string | null;
  episodes_watched?: number | string | null;
}

export async function getPublicProfileOgDataByUsername(username: string) {
  const response = await supabaseFetch<
    PublicProfileOgRow | PublicProfileOgRow[]
  >("rpc/get_public_profile_og_data", {
    method: "POST",
    body: JSON.stringify({ profile_username: username }),
  }).catch(() => null);
  const data = firstRow(response);
  if (!data) return getPublicProfileOgDataFallback(username);

  if (data.movies_watched == null || data.series_watched == null) {
    try {
      const fallback = await getPublicProfileOgDataFallback(username);
      if (fallback) return fallback;
    } catch (error) {
      console.warn("[profile-og-data] legacy RPC aggregate fallback failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        stage: "legacy-rpc-aggregate",
        username,
      });
    }
  }

  return {
    avatarUrl: data.avatar_url as string | null,
    bannerUrl: data.banner_url as string | null,
    bio: data.bio as string | null,
    diaryEntries: Number(data.diary_entries) || 0,
    displayName: (data.display_name ||
      data.username ||
      "Kino member") as string,
    moviesWatched: toSafeCount(data.movies_watched ?? data.movie_ratings ?? 0),
    seriesWatched: toSafeCount(data.series_watched ?? data.episodes_watched ?? 0),
    username: data.username as string | null,
  };
}

async function getPublicProfileOgDataFallback(username: string) {
  const { key, url } = supabaseConfig();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error } = await client
    .from("user_profiles")
    .select("id,username,display_name,avatar_url,banner_url,bio")
    .ilike("username", username)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  return {
    avatarUrl: profile.avatar_url,
    bannerUrl: profile.banner_url,
    bio: profile.bio,
    diaryEntries: 0,
    displayName: profile.display_name || profile.username || "Kino member",
    moviesWatched: 0,
    seriesWatched: 0,
    username: profile.username,
  };
}

function toSafeCount(value: number | string | null) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export type PublicProfileOgData = NonNullable<
  Awaited<ReturnType<typeof getPublicProfileOgDataByUsername>>
>;

export async function getPublicProfileOgData(
  id: string
): Promise<PublicProfileOgData | null> {
  const response = await supabaseFetch<Array<{ username: string | null }>>(
    `user_profiles?select=username&id=eq.${encodeURIComponent(id)}&limit=1`
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
  id: string
): Promise<PublicWatchlistOgData | null> {
  const response = await supabaseFetch<
    Array<{
      name: string;
      description: string | null;
      is_shared: boolean;
    }>
  >(
    `watchlists?select=name,description,is_shared&id=eq.${encodeURIComponent(id)}&limit=1`
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
