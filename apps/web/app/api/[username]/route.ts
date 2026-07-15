import { ImageResponse } from "next/og";
import { createElement, type ReactElement } from "react";

import { FallbackOg, getOgImageOptions, ProfileOg } from "@/lib/og";
import { safeImageData } from "@/lib/og-images";
import {
  isReservedProfileRoute,
  normalizeProfileUsername,
} from "@/lib/profile-routes";
import { getPublicProfileOgDataByUsername } from "@/lib/server-supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const routeParams = await params;
  const username = normalizeProfileUsername(routeParams.username);
  const logo = await safeImageData(
    new URL("/kino-logo.png", request.url).toString(),
  );

  if (!username || isReservedProfileRoute(username)) {
    console.warn("[profile-og] rejected invalid or reserved username", {
      stage: "route-validation",
      username: routeParams.username,
    });
    return image(
      createElement(FallbackOg, {
        label: "Profile preview",
        logo,
        title: "This profile is unavailable.",
      }),
    );
  }

  try {
    const profile = await getPublicProfileOgDataByUsername(username);

    if (!profile) {
      console.info("[profile-og] profile not found", {
        stage: "profile-lookup",
        username,
      });
      return image(
        createElement(FallbackOg, {
          label: "Profile preview",
          logo,
          title: "This profile is unavailable.",
        }),
      );
    }

    const data = profile;
    const [avatar, background] = await Promise.all([
      safeImageData(data.avatarUrl),
      safeImageData(data.bannerUrl),
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
      stage: "image-generation",
      username,
    });
    return image(
      createElement(FallbackOg, {
        label: "Profile preview",
        logo,
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
