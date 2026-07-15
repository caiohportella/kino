import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { notFound, permanentRedirect } from "next/navigation";
import { ProfileView } from "@/components/profile-view";
import {
  isReservedProfileRoute,
  normalizeProfileUsername,
  profileOgPath,
} from "@/lib/profile-routes";
import { absoluteUrl } from "@/lib/seo";

async function getProfile(username: string) {
  if (isReservedProfileRoute(username)) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      "https://example.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      "missing-anon-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client
    .from("user_profiles")
    .select("*")
    .ilike("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const routeParams = await params;
  const username = normalizeProfileUsername(routeParams.username);
  if (!username || isReservedProfileRoute(username)) return {};

  let profile;
  let lookupFailed = false;
  try {
    profile = await getProfile(username);
  } catch (error) {
    lookupFailed = true;
    console.error("[profile-metadata] profile lookup failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      stage: "profile-lookup",
      username,
    });
  }

  const canonicalUsername = profile?.username || username;
  const canonical = absoluteUrl(`/${encodeURIComponent(canonicalUsername)}`);
  const title =
    profile?.display_name ||
    (profile
      ? canonicalUsername
      : lookupFailed
        ? "Profile unavailable"
        : "Profile not found");
  const description =
    profile?.bio ||
    (profile
      ? `See @${canonicalUsername}'s movies, series, ratings, and diary on Kino.`
      : lookupFailed
        ? `The Kino profile @${canonicalUsername} could not be loaded.`
        : `The Kino profile @${canonicalUsername} does not exist.`);
  const image = absoluteUrl(profileOgPath(canonicalUsername));

  return {
    title,
    description,
    alternates: { canonical },
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
          alt: profile ? `${title}'s Kino profile` : "Kino profile unavailable",
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
  const normalizedUsername = normalizeProfileUsername(username);
  if (!normalizedUsername || isReservedProfileRoute(normalizedUsername)) {
    notFound();
  }

  const profile = await getProfile(normalizedUsername);
  if (!profile) notFound();
  if (profile.username !== normalizedUsername) {
    permanentRedirect(`/${encodeURIComponent(profile.username)}`);
  }
  return <ProfileView username={normalizedUsername} />;
}
