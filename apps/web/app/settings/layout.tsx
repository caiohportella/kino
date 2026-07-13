import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Settings",
  description: "Edit your Kino profile, language, and account settings.",
  alternates: {
    canonical: absoluteUrl("/settings"),
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    title: "Settings | Kino",
    type: "website",
    url: absoluteUrl("/settings"),
  },
  twitter: {
    card: "summary_large_image",
    description: SITE_DESCRIPTION,
    title: "Settings | Kino",
  },
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
