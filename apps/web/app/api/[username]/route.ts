import { ImageResponse } from "next/og";
import { createElement } from "react";

import { getOgImageOptions, ProfileOg } from "@/lib/og";
import { getPublicProfileOgDataByUsername } from "@/lib/server-supabase";

const fallbackProfileData = {
  avatarUrl: null,
  bio: "Movies, series, and a viewing history kept on Kino.",
  diaryEntries: 0,
  displayName: "Kino member",
  episodesWatched: 0,
  movieRatings: 0,
  username: null,
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  try {
    const profile = await getPublicProfileOgDataByUsername(username);

    const data = profile ?? fallbackProfileData;
    return new ImageResponse(
      createElement(ProfileOg, {
        avatar: data.avatarUrl,
        data,
      }),
      await getOgImageOptions({
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      }),
    );
  } catch {
    return new ImageResponse(
      createElement(ProfileOg, {
        avatar: null,
        data: {
          ...fallbackProfileData,
          username: null,
        },
      }),
      await getOgImageOptions({
        "cache-control": "public, max-age=86400",
      }),
    );
  }
}
