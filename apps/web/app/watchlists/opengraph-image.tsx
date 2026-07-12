import { ImageResponse } from "next/og";
import {
  getOgImageOptions,
  OG_CONTENT_TYPE,
  OG_SIZE,
  WatchlistsOg,
} from "@/lib/og";

export const runtime = "edge";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Kino watchlists — save and curate movies and series";

export default async function OpenGraphImage() {
  return new ImageResponse(<WatchlistsOg />, await getOgImageOptions());
}
