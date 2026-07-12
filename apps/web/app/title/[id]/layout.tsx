import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { cache, type ReactNode } from "react";
import {
  isCanonicalResourceSegment,
  parseResourceSegment,
  titlePath,
} from "@/lib/routes";
import { getTitleSeoDataById } from "@/lib/server-tmdb";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  buildTitleDescription,
  buildTitleSchema,
} from "@/lib/seo";
import { socialMetadataText } from "@/lib/text";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tmdbId = parseResourceSegment(id).id;

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return {
      title: "Title not found",
      description: SITE_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }

  try {
    const details = await getTitleSeoDataById(tmdbId);
    const pageTitle = socialMetadataText(
      `${details.title}${details.year ? ` (${details.year})` : ""}`,
    );
    const description = socialMetadataText(buildTitleDescription(details));
    const canonical = absoluteUrl(
      titlePath(tmdbId, details.title, details.type),
    );

    return {
      title: pageTitle,
      description,
      alternates: {
        canonical,
      },
      openGraph: {
        description,
        siteName: SITE_NAME,
        title: pageTitle,
        type: "website",
        url: canonical,
      },
      robots: {
        index: true,
        follow: true,
      },
      twitter: {
        card: "summary_large_image",
        description,
        title: pageTitle,
      },
    };
  } catch {
    const fallbackTitle = `Title ${tmdbId}`;
    return {
      title: fallbackTitle,
      description: SITE_DESCRIPTION,
      alternates: {
        canonical: absoluteUrl(`/title/${tmdbId}`),
      },
      robots: {
        index: false,
        follow: false,
      },
      openGraph: {
        description: SITE_DESCRIPTION,
        siteName: SITE_NAME,
        title: fallbackTitle,
        type: "website",
        url: absoluteUrl(`/title/${tmdbId}`),
      },
      twitter: {
        card: "summary_large_image",
        description: SITE_DESCRIPTION,
        title: fallbackTitle,
      },
    };
  }
}

const getTitleJsonLd = cache(async (tmdbId: number) => {
  const details = await getTitleSeoDataById(tmdbId);
  return buildTitleSchema({
    details,
    url: absoluteUrl(titlePath(tmdbId, details.title, details.type)),
  });
});

export default async function TitleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tmdbId = parseResourceSegment(id).id;

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return children;
  }

  const details = await getTitleSeoDataById(tmdbId);
  const canonicalPath = titlePath(tmdbId, details.title, details.type);
  if (!isCanonicalResourceSegment(id, tmdbId, details.title))
    permanentRedirect(canonicalPath);
  const jsonLd = await getTitleJsonLd(tmdbId);
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: safeJsonLd }}
        type="application/ld+json"
      />
      {children}
    </>
  );
}
