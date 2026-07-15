import type { MediaType } from "@kino/core";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createElement, type ReactElement } from "react";
import { FallbackOg, getOgImageOptions, TitleOg } from "@/lib/og";
import { safeImageData } from "@/lib/og-images";
import { getTitleSeoData } from "@/lib/server-tmdb";
import { getTitlePresentation } from "@/lib/seo";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tmdbId = Number(id);
  const logo = await safeImageData(
    new URL("/kino-logo.png", request.url).toString(),
  );
  const type: MediaType =
    request.nextUrl.searchParams.get("type") === "tv" ? "tv" : "movie";

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return image(
      createElement(FallbackOg, {
        title: "This title is unavailable.",
        label: "Title preview",
        logo,
      }),
    );
  }

  try {
    const details = await getTitleSeoData(tmdbId, type, "en");
    const presentation = getTitlePresentation(details);
    const [backdrop, poster] = await Promise.all([
      safeImageData(details.backdropImage),
      safeImageData(details.coverImage),
    ]);

    return image(
      createElement(TitleOg, {
        backdrop,
        genres: details.genres.map((genre) => genre.name),
        logo,
        poster,
        runtime: details.runtime,
        seasons: details.totalSeasons,
        status: details.status,
        synopsis: details.synopsis,
        title: presentation.title,
        type,
        year: presentation.year,
      }),
    );
  } catch {
    return image(
      createElement(FallbackOg, {
        title: "This title is unavailable.",
        label: "Title preview",
        logo,
      }),
    );
  }
}

async function image(element: ReactElement) {
  return new ImageResponse(
    element,
    await getOgImageOptions({
      "cache-control": "public, max-age=300, stale-while-revalidate=86400",
    }),
  );
}
