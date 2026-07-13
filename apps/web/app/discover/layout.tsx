import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_NAME, absoluteUrl, socialImage } from "@/lib/seo";

const description =
  "Browse trending movies, popular TV series, new releases, and top-rated picks in Kino.";
const image = socialImage(
  "/discover/opengraph-image",
  "Discover movies and series on Kino",
);

export const metadata: Metadata = {
  title: "Discover",
  description,
  alternates: {
    canonical: absoluteUrl("/discover"),
  },
  openGraph: {
    description,
    images: [image],
    siteName: SITE_NAME,
    title: "Discover | Kino",
    type: "website",
    url: absoluteUrl("/discover"),
  },
  twitter: {
    card: "summary_large_image",
    description,
    images: [image],
    title: "Discover | Kino",
  },
};

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children;
}
