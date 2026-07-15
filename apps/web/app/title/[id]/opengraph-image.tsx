import { ImageResponse } from "next/og";
import {
  FallbackOg,
  getOgImageOptions,
  OG_CONTENT_TYPE,
  OG_SIZE,
  TitleOg,
} from "@/lib/og";
import { parseResourceSegment } from "@/lib/routes";
import { safeImageData } from "@/lib/og-images";
import { KINO_OG_LOGO_URL } from "@/lib/og-assets";
import { getTitleSeoDataBySegment } from "@/lib/server-tmdb";
import { getTitlePresentation } from "@/lib/seo";

export const runtime = "edge";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Kino title preview";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const segment = parseResourceSegment(id);
  const tmdbId = segment.id;
  const logo = await safeImageData(KINO_OG_LOGO_URL);

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return new ImageResponse(
      <FallbackOg
        label="Title preview"
        logo={logo}
        title="This title is unavailable."
      />,
      await getOgImageOptions()
    );
  }

  try {
    const details = await getTitleSeoDataBySegment(tmdbId, segment.slug, "en");
    const presentation = getTitlePresentation(details);
    const [backdrop, poster] = await Promise.all([
      safeImageData(details.backdropImage),
      safeImageData(details.coverImage),
    ]);

    return new ImageResponse(
      <TitleOg
        backdrop={backdrop}
        genres={details.genres.map((genre) => genre.name)}
        logo={logo}
        poster={poster}
        runtime={details.runtime}
        seasons={details.totalSeasons}
        status={details.status}
        synopsis={details.synopsis}
        title={presentation.title}
        type={details.type}
        year={presentation.year}
      />,
      await getOgImageOptions()
    );
  } catch {
    return new ImageResponse(
      <FallbackOg
        label="Title preview"
        logo={logo}
        title="This title is unavailable."
      />,
      await getOgImageOptions()
    );
  }
}
