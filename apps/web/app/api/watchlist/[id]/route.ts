import { ImageResponse } from "next/og";
import { createElement, type ReactElement } from "react";
import { FallbackOg, getOgImageOptions, WatchlistOg } from "@/lib/og";
import { safeImageData } from "@/lib/og-images";
import { getPublicWatchlistOgData } from "@/lib/server-supabase";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await getPublicWatchlistOgData(id);
    if (!data)
      return image(
        createElement(FallbackOg, {
          title: "This watchlist is private or unavailable.",
          label: "Watchlist preview",
        }),
      );

    const [images, avatars] = await Promise.all([
      Promise.all(
        data.titles
          .slice(0, 3)
          .map((title) =>
            safeImageData(title.cover_image || title.backdrop_image),
          ),
      ),
      Promise.all(
        data.participants
          .slice(0, 5)
          .map((participant) => safeImageData(participant.avatarUrl)),
      ),
    ]);
    return image(createElement(WatchlistOg, { avatars, data, images }));
  } catch {
    return image(
      createElement(FallbackOg, {
        title: "This watchlist is private or unavailable.",
        label: "Watchlist preview",
      }),
    );
  }
}

async function image(element: ReactElement) {
  return new ImageResponse(
    element,
    await getOgImageOptions({
      "cache-control": "public, max-age=180, stale-while-revalidate=1800",
    }),
  );
}
