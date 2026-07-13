import { ImageResponse } from "next/og";
import { createElement } from "react";

import { getOgImageOptions, ProfileOg } from "@/lib/og";
import { safeImageData } from "@/lib/og-images";
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
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  try {
    const profile = await getPublicProfileOgDataByUsername(username);

    const data = profile ?? { ...fallbackProfileData, username };
    const avatar = await safeImageData(data.avatarUrl);
    const logo = new URL('/kino-logo.png', request.url).toString();
    return new ImageResponse(
      createElement(ProfileOg, {
        avatar,
        data,
        logo,
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
          username,
        },
        logo: new URL('/kino-logo.png', request.url).toString(),
      }),
      await getOgImageOptions({
        "cache-control": "public, max-age=86400",
      }),
    );
  }
}
