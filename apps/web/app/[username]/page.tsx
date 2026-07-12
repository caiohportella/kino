import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { notFound, permanentRedirect } from "next/navigation";
import { ProfileView } from "@/components/profile-view";
import { absoluteUrl } from "@/lib/seo";
import { isReservedProfileRoute } from "@/lib/profile-routes";

async function getProfile(username: string) {
  if (isReservedProfileRoute(username)) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing-anon-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await client
    .from("user_profiles")
    .select("*")
    .ilike("username", username)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) return {};

  const canonical = absoluteUrl(`/${profile.username}`);
  const title = profile.display_name || profile.username;
  const description =
    profile.bio ||
    `See @${profile.username}'s movies, series, ratings, and diary on Kino.`;

  const image = absoluteUrl(`/api/${encodeURIComponent(profile.username)}`);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "profile",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${title}’s Kino profile`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function UsernameProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();
  if (profile.username !== username) {
    permanentRedirect(`/${profile.username}`);
  }
  return <ProfileView username={username} />;
}
