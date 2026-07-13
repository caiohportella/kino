import type { TMDbPerson, TitleDetails } from "@kino/core";
import { cache } from "react";

const DEFAULT_SITE_URL = "https://kino.vercel.app";

export const SITE_NAME = "Kino";
export const SITE_DESCRIPTION =
  "Kino is a calm movie and series tracking companion for discovery, watchlists, diary entries, and ratings.";
export const SITE_TAGLINE =
  "Track movies, series, and what you watched in one calm home.";

function normalizeOrigin(value: string | undefined) {
  if (!value) return DEFAULT_SITE_URL;
  const origin = value.replace(/\/+$/, "");
  return origin.startsWith("http://") || origin.startsWith("https://")
    ? origin
    : `https://${origin}`;
}

export const getSiteOrigin = cache(() =>
  normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.EXPO_PUBLIC_WEB_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL,
  ),
);

export function absoluteUrl(pathname: string) {
  return new URL(pathname, getSiteOrigin()).toString();
}

export function socialImage(pathname: string, alt: string) {
  return {
    url: absoluteUrl(pathname),
    width: 1200,
    height: 630,
    alt,
    type: "image/png",
  };
}

export function getTitlePresentation(
  details: Pick<TitleDetails, "title" | "year">,
) {
  const title = details.title.replace(/\s+/g, " ").trim();
  const year =
    Number.isInteger(details.year) && details.year >= 1888
      ? details.year
      : null;

  return { title, year };
}

export function trimText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function buildTitleDescription(
  details: Pick<
    TitleDetails,
    "synopsis" | "title" | "year" | "type" | "runtime" | "totalSeasons"
  >,
) {
  const base = details.synopsis ? trimText(details.synopsis, 160) : "";
  if (base) return base;

  const formatType = details.type === "tv" ? "TV series" : "movie";
  const extras = [
    details.year || 0 ? String(details.year) : null,
    details.runtime ? formatRuntime(details.runtime) : null,
    details.totalSeasons ? `${details.totalSeasons} seasons` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return extras
    ? `${details.title} is a ${formatType} from ${extras}.`
    : `Explore ${details.title} on Kino.`;
}

export function buildPersonDescription(
  person: Pick<TMDbPerson, "name" | "biography" | "known_for_department">,
) {
  const biography = person.biography ? trimText(person.biography, 160) : "";
  if (biography) return biography;
  const department = person.known_for_department
    ? ` in ${person.known_for_department.toLowerCase()}`
    : "";
  return `${person.name}${department} on Kino.`;
}

export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: absoluteUrl("/search"),
      "query-input": "required name=query",
    },
  };
}

export function buildSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function buildTitleSchema({
  details,
  url,
}: {
  details: Pick<
    TitleDetails,
    | "title"
    | "synopsis"
    | "year"
    | "type"
    | "runtime"
    | "totalSeasons"
    | "genres"
    | "coverImage"
    | "backdropImage"
  >;
  url: string;
}) {
  const schemaType = details.type === "tv" ? "TVSeries" : "Movie";
  const image = details.backdropImage || details.coverImage;

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: details.title,
    url,
    description: buildTitleDescription(details),
    about: {
      "@type": schemaType,
      name: details.title,
      description: buildTitleDescription(details),
      image: image ? [image] : undefined,
      datePublished: details.year ? `${details.year}-01-01` : undefined,
      genre: details.genres?.map((genre) => genre.name),
      duration: details.runtime ? `PT${details.runtime}M` : undefined,
      numberOfSeasons: details.totalSeasons || undefined,
    },
  };
}

export function buildPersonSchema({
  person,
  url,
  image,
}: {
  person: Pick<
    TMDbPerson,
    | "name"
    | "biography"
    | "birthday"
    | "deathday"
    | "place_of_birth"
    | "known_for_department"
  >;
  url: string;
  image: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: person.name,
    url,
    description: buildPersonDescription(person),
    mainEntity: {
      "@type": "Person",
      name: person.name,
      description: buildPersonDescription(person),
      birthDate: person.birthday || undefined,
      deathDate: person.deathday || undefined,
      homeLocation: person.place_of_birth || undefined,
      jobTitle: person.known_for_department || undefined,
      image: image ? [image] : undefined,
    },
  };
}

function formatRuntime(minutes: number | undefined) {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}
