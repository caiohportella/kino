import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { cache } from "react";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  buildPersonDescription,
  buildPersonSchema,
} from "@/lib/seo";
import { getPersonSeoData } from "@/lib/server-tmdb";
import {
  isCanonicalResourceSegment,
  parseResourceSegment,
  personPath,
} from "@/lib/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const personId = parseResourceSegment(id).id;

  if (!Number.isFinite(personId) || personId <= 0) {
    return {
      title: "Person not found",
      description: SITE_DESCRIPTION,
      robots: { index: false, follow: false },
    };
  }

  try {
    const person = await getPersonSeoData(personId);
    const pageTitle = person.name;
    const description = buildPersonDescription(person);
    const canonical = absoluteUrl(personPath(personId, person.name));

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
        type: "profile",
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
    const fallbackTitle = `Person ${personId}`;
    return {
      title: fallbackTitle,
      description: SITE_DESCRIPTION,
      alternates: {
        canonical: absoluteUrl(`/person/${personId}`),
      },
      robots: {
        index: false,
        follow: false,
      },
      openGraph: {
        description: SITE_DESCRIPTION,
        siteName: SITE_NAME,
        title: fallbackTitle,
        type: "profile",
        url: absoluteUrl(`/person/${personId}`),
      },
      twitter: {
        card: "summary_large_image",
        description: SITE_DESCRIPTION,
        title: fallbackTitle,
      },
    };
  }
}

const getPersonJsonLd = cache(async (personId: number) => {
  const person = await getPersonSeoData(personId);
  const image = person.profile_path
    ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
    : null;
  return buildPersonSchema({
    person,
    image,
    url: absoluteUrl(personPath(personId, person.name)),
  });
});

export default async function PersonLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const personId = parseResourceSegment(id).id;
  if (!Number.isFinite(personId) || personId <= 0) return children;

  try {
    const person = await getPersonSeoData(personId);
    const canonicalPath = personPath(personId, person.name);
    if (!isCanonicalResourceSegment(id, personId, person.name))
      permanentRedirect(canonicalPath);
    const jsonLd = await getPersonJsonLd(personId);
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
  } catch {
    return children;
  }
}
