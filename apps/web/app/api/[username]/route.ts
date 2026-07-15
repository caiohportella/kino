import { ImageResponse } from "next/og";
import { createElement, type ReactElement } from "react";

import { FallbackOg, getOgImageOptions, ProfileOg } from "@/lib/og";
import { safeImageData } from "@/lib/og-images";
import { getPublicProfileOgDataByUsername } from "@/lib/server-supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const profile = await getPublicProfileOgDataByUsername(username);

    if (!profile) {
      return image(
        createElement(FallbackOg, {
          label: "Profile preview",
          title: "This profile is unavailable.",
        }),
      );
    }

    const data = profile;
    const [avatar, background, logo] = await Promise.all([
      safeImageData(data.avatarUrl),
      safeImageData(data.bannerUrl),
      safeImageData(new URL("/kino-logo.png", request.url).toString()),
    ]);
    return image(
      createElement(ProfileOg, {
        avatar,
        background,
        data,
        logo,
      }),
    );
  } catch (error) {
    console.error("[profile-og] generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      username,
    });
    return image(
      createElement(FallbackOg, {
        label: "Profile preview",
        title: "This profile is unavailable.",
      }),
    );
  }
}

async function image(element: ReactElement) {
  return new ImageResponse(
    element,
    await getOgImageOptions({
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    }),
  );
}
