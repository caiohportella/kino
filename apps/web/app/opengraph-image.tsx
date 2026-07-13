import { ImageResponse } from "next/og";
import {
  getOgImageOptions,
  HomeOg,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og";

export const runtime = "edge";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Kino — discover, track, and share movies and series";

export default async function OpenGraphImage() {
  return new ImageResponse(<HomeOg />, await getOgImageOptions());
}
